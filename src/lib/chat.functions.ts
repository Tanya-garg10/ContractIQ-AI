import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const askContract = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({
        question: z.string().min(1).max(2000),
        contextJson: z.string(),
        history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }))
      }).parse(input),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");

    const systemPrompt = `You are a legal contract assistant answering questions about a specific contract that has already been analyzed.

You have the following structured knowledge about the contract as JSON (extracted clauses, risks, and executive synthesis):

<contract_analysis>
${data.contextJson}
</contract_analysis>

Rules:
- Answer strictly based on the analysis above. If the answer is not present, say so plainly and suggest what section of the contract to check.
- Be concise (2–5 sentences unless the user asks for detail). Use markdown for structure.
- Quote short clauses in italics when helpful.
- Never invent dates, amounts, or party names that are not in the analysis.`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          ...data.history,
          { role: "user", content: data.question },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      const msg =
        res.status === 429
          ? "AI rate limit reached. Please try again in a minute."
          : res.status === 402
            ? "AI credits exhausted for this workspace."
            : `AI gateway error ${res.status}: ${body.slice(0, 200)}`;
      throw new Error(msg);
    }

    const payload = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const answer =
      payload.choices?.[0]?.message?.content?.trim() ||
      "I couldn't generate an answer. Please try rephrasing.";

    return { answer };
  });
