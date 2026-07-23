import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const SYSTEM_PROMPT = `You are a senior contract analyst. Read the attached contract carefully and respond with a single JSON object (no prose, no markdown, no code fences) matching exactly this shape:

{
  "extraction": {
    "parties":         [ { "name": string, "role": string } ],
    "dates":           { "effective": string|null, "termination": string|null, "signed": string|null },
    "payment":         { "amount": string|null, "schedule": string|null, "terms": string|null },
    "obligations":     [ { "party": string, "description": string } ],
    "confidentiality": { "present": boolean, "duration": string|null, "scope": string|null },
    "termination":     { "notice_period": string|null, "conditions": string|null },
    "renewal":         { "auto_renew": boolean, "term": string|null, "notice_required": string|null },
    "penalties":       [ { "trigger": string, "amount": string } ],
    "confidence":      number,        // 0-100, how confident you are in the extraction
    "missing_fields":  [ string ]     // fields you could not find in the document
  },
  "risks": [
    {
      "severity":       "high" | "medium" | "low",
      "category":       string,       // e.g. "Auto-renewal", "Liability cap", "Data protection"
      "clause_text":    string,       // short quote from the contract (<=280 chars)
      "explanation":    string,       // why this is a concern
      "recommendation": string        // suggested negotiation or mitigation
    }
  ],
  "synthesis": {
    "summary":         string,        // 3-5 sentence executive summary
    "key_insights":    [ string ],    // 3-6 bullet insights
    "recommendations": [ string ],    // 3-6 bullets
    "action_items":    [ string ]     // concrete next steps
  }
}

If the document is not actually a contract, still return the JSON with best-effort empty values and set extraction.confidence = 0.`;

export const analyzeContractContent = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({
      base64: z.string(),
      mime: z.string(),
      filename: z.string()
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const { base64, mime, filename } = data;
    const isImage = mime.startsWith("image/");

    const mediaBlock = isImage
      ? { type: "image_url", image_url: { url: `data:${mime};base64,${base64}` } }
      : {
          type: "file",
          file: {
            filename: filename,
            file_data: `data:application/pdf;base64,${base64}`,
          },
        };

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze the attached contract titled "${filename}" and return the JSON described in the system prompt. Be thorough but return valid JSON only.`,
              },
              mediaBlock,
            ],
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      const body = await aiRes.text();
      if (aiRes.status === 429)
        throw new Error("AI rate limit reached. Please try again in a minute.");
      throw new Error(`AI API error ${aiRes.status}: ${body.slice(0, 300)}`);
    }

    const payload = (await aiRes.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = payload.choices?.[0]?.message?.content;
    if (!raw) throw new Error("AI returned an empty response");

    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const m = raw.match(/\{[\s\S]*\}/);
      if (!m) throw new Error("AI returned non-JSON output");
      parsed = JSON.parse(m[0]);
    }

    return parsed;
  });
