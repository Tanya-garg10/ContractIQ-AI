import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// Structured JSON shape the model returns. Everything is optional so we can
// gracefully persist partial output.
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

type AgentKey = "ingestion" | "parser" | "extractor" | "validator" | "risk" | "synthesis";
type AgentState = "queued" | "running" | "done";

function states(map: Partial<Record<AgentKey, AgentState>>): Record<AgentKey, AgentState> {
  return {
    ingestion: "queued",
    parser: "queued",
    extractor: "queued",
    validator: "queued",
    risk: "queued",
    synthesis: "queued",
    ...map,
  };
}

function bytesToBase64(bytes: Uint8Array): string {
  // Chunked to avoid call-stack overflow on large PDFs.
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export const startAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ contract_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const contractId = data.contract_id;

    const { data: contract, error: cErr } = await supabase
      .from("contracts")
      .select("id, user_id, filename, storage_path, mime")
      .eq("id", contractId)
      .maybeSingle();
    if (cErr || !contract) throw new Error(cErr?.message ?? "Contract not found");
    if (contract.user_id !== userId) throw new Error("Forbidden");

    // Idempotency: don't restart a running/completed run.
    const { data: existing } = await supabase
      .from("analysis_runs")
      .select("id, status")
      .eq("contract_id", contractId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing && (existing.status === "running" || existing.status === "completed")) {
      return { run_id: existing.id, status: existing.status };
    }

    const { data: run, error: rErr } = await supabase
      .from("analysis_runs")
      .insert({
        contract_id: contractId,
        status: "running",
        current_agent: "ingestion",
        agent_states: states({ ingestion: "running" }),
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (rErr || !run) throw new Error(rErr?.message ?? "Failed to create run");

    await supabase.from("contracts").update({ status: "analyzing" }).eq("id", contractId);

    const setStage = async (
      current: AgentKey | null,
      map: Partial<Record<AgentKey, AgentState>>,
    ) => {
      await supabase
        .from("analysis_runs")
        .update({ current_agent: current, agent_states: states(map) })
        .eq("id", run.id);
    };

    const fail = async (msg: string) => {
      await supabase
        .from("analysis_runs")
        .update({
          status: "failed",
          error: msg.slice(0, 500),
          completed_at: new Date().toISOString(),
        })
        .eq("id", run.id);
      await supabase.from("contracts").update({ status: "failed" }).eq("id", contractId);
    };

    try {
      // ── Ingestion: pull the file out of storage ──────────────────────────
      const { data: file, error: dlErr } = await supabase.storage
        .from("contracts")
        .download(contract.storage_path);
      if (dlErr || !file) throw new Error(dlErr?.message ?? "Failed to download contract file");
      const buf = new Uint8Array(await file.arrayBuffer());
      const b64 = bytesToBase64(buf);

      await setStage("parser", { ingestion: "done", parser: "running" });

      const mime = contract.mime || "application/pdf";
      const nameLower = contract.filename.toLowerCase();
      const isImage = mime.startsWith("image/");
      const isPdf = mime === "application/pdf" || nameLower.endsWith(".pdf");
      const isDocx =
        mime.includes("word") ||
        nameLower.endsWith(".docx") ||
        nameLower.endsWith(".doc");

      if (isDocx) {
        throw new Error(
          "DOCX support is coming soon — please upload a PDF or image of the contract for now.",
        );
      }
      if (!isPdf && !isImage) {
        throw new Error(`Unsupported file type: ${mime || "unknown"}`);
      }

      const mediaBlock = isImage
        ? { type: "image_url", image_url: { url: `data:${mime};base64,${b64}` } }
        : {
            type: "file",
            file: {
              filename: contract.filename,
              file_data: `data:application/pdf;base64,${b64}`,
            },
          };

      await setStage("extractor", {
        ingestion: "done",
        parser: "done",
        extractor: "running",
      });

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
                  text: `Analyze the attached contract titled "${contract.filename}" and return the JSON described in the system prompt. Be thorough but return valid JSON only.`,
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

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(raw);
      } catch {
        const m = raw.match(/\{[\s\S]*\}/);
        if (!m) throw new Error("AI returned non-JSON output");
        parsed = JSON.parse(m[0]);
      }

      const ex = (parsed.extraction ?? {}) as Record<string, unknown>;
      const risks = Array.isArray(parsed.risks)
        ? (parsed.risks as Array<Record<string, unknown>>)
        : [];
      const syn = (parsed.synthesis ?? {}) as Record<string, unknown>;

      await setStage("validator", {
        ingestion: "done",
        parser: "done",
        extractor: "done",
        validator: "running",
      });

      await supabase.from("extractions").upsert({
        contract_id: contractId,
        parties: (ex.parties as any) ?? null,
        dates: (ex.dates as any) ?? null,
        payment: (ex.payment as any) ?? null,
        obligations: (ex.obligations as any) ?? null,
        confidentiality: (ex.confidentiality as any) ?? null,
        termination: (ex.termination as any) ?? null,
        renewal: (ex.renewal as any) ?? null,
        penalties: (ex.penalties as any) ?? null,
        confidence: typeof ex.confidence === "number" ? ex.confidence : null,
        missing_fields: (ex.missing_fields as any) ?? null,
      });

      await setStage("risk", {
        ingestion: "done",
        parser: "done",
        extractor: "done",
        validator: "done",
        risk: "running",
      });

      await supabase.from("risks").delete().eq("contract_id", contractId);
      if (risks.length) {
        await supabase.from("risks").insert(
          risks.map((r) => ({
            contract_id: contractId,
            severity: ["high", "medium", "low"].includes(String(r.severity))
              ? (r.severity as string)
              : "medium",
            category: String(r.category ?? "General"),
            clause_text: (r.clause_text as string) ?? null,
            explanation: (r.explanation as string) ?? null,
            recommendation: (r.recommendation as string) ?? null,
          })),
        );
      }

      await setStage("synthesis", {
        ingestion: "done",
        parser: "done",
        extractor: "done",
        validator: "done",
        risk: "done",
        synthesis: "running",
      });

      await supabase.from("synthesis").upsert({
        contract_id: contractId,
        summary: (syn.summary as string) ?? null,
        key_insights: (syn.key_insights as any) ?? null,
        recommendations: (syn.recommendations as any) ?? null,
        action_items: (syn.action_items as any) ?? null,
      });

      await supabase
        .from("analysis_runs")
        .update({
          status: "completed",
          current_agent: null,
          agent_states: states({
            ingestion: "done",
            parser: "done",
            extractor: "done",
            validator: "done",
            risk: "done",
            synthesis: "done",
          }),
          completed_at: new Date().toISOString(),
        })
        .eq("id", run.id);
      await supabase.from("contracts").update({ status: "completed" }).eq("id", contractId);

      return { run_id: run.id, status: "completed" as const };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await fail(msg);
      throw new Error(msg);
    }
  });

export const getAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ contract_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const cid = data.contract_id;
    const [contract, run, extraction, risksRes, synthesis] = await Promise.all([
      supabase.from("contracts").select("*").eq("id", cid).maybeSingle(),
      supabase
        .from("analysis_runs")
        .select("*")
        .eq("contract_id", cid)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from("extractions").select("*").eq("contract_id", cid).maybeSingle(),
      supabase.from("risks").select("*").eq("contract_id", cid),
      supabase.from("synthesis").select("*").eq("contract_id", cid).maybeSingle(),
    ]);

    const severityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
    const risks = (risksRes.data ?? []).sort(
      (a, b) => (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3),
    );

    return {
      contract: contract.data,
      run: run.data,
      extraction: extraction.data,
      risks,
      synthesis: synthesis.data,
    };
  });
