import { createServerFn } from "@tanstack/react-start";
import { attachFirebaseAuth } from "@/integrations/firebase/auth-attacher";
import { db, storage } from "@/integrations/firebase/client.server";
import { z } from "zod";
import { doc, getDoc, setDoc, collection, addDoc, getDocs, query, where, orderBy, limit, deleteDoc, updateDoc } from "firebase/firestore";
import { ref, getBytes } from "firebase/storage";

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
  .middleware([attachFirebaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ contract_id: z.string() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { user } = context;
    const contractId = data.contract_id;

    const contractRef = doc(db, "contracts", contractId);
    const contractSnap = await getDoc(contractRef);
    
    if (!contractSnap.exists()) throw new Error("Contract not found");
    const contract = contractSnap.data();
    if (contract.user_id !== user.id) throw new Error("Forbidden");

    // Idempotency: don't restart a running/completed run.
    const runsQuery = query(
      collection(db, `contracts/${contractId}/analysis_runs`),
      orderBy("created_at", "desc"),
      limit(1)
    );
    const existingRuns = await getDocs(runsQuery);
    const existing = existingRuns.docs[0]?.data();
    
    if (existing && (existing.status === "running" || existing.status === "completed")) {
      return { run_id: existingRuns.docs[0].id, status: existing.status };
    }

    const runRef = await addDoc(collection(db, `contracts/${contractId}/analysis_runs`), {
      contract_id: contractId,
      status: "running",
      current_agent: "ingestion",
      agent_states: states({ ingestion: "running" }),
      started_at: new Date().toISOString(),
    });

    await updateDoc(contractRef, { status: "analyzing" });

    const setStage = async (
      current: AgentKey | null,
      map: Partial<Record<AgentKey, AgentState>>,
    ) => {
      await updateDoc(runRef, { current_agent: current, agent_states: states(map) });
    };

    const fail = async (msg: string) => {
      await updateDoc(runRef, {
        status: "failed",
        error: msg.slice(0, 500),
        completed_at: new Date().toISOString(),
      });
      await updateDoc(contractRef, { status: "failed" });
    };

    try {
      // ── Ingestion: pull the file out of storage ──────────────────────────
      const storageRef = ref(storage, contract.storage_path);
      const buf = await getBytes(storageRef);
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

      await setDoc(doc(db, `contracts/${contractId}/extractions`, "latest"), {
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

      // Delete existing risks
      const existingRisks = await getDocs(collection(db, `contracts/${contractId}/risks`));
      for (const riskDoc of existingRisks.docs) {
        await deleteDoc(riskDoc.ref);
      }
      
      if (risks.length) {
        for (const r of risks) {
          await addDoc(collection(db, `contracts/${contractId}/risks`), {
            contract_id: contractId,
            severity: ["high", "medium", "low"].includes(String(r.severity))
              ? (r.severity as string)
              : "medium",
            category: String(r.category ?? "General"),
            clause_text: (r.clause_text as string) ?? null,
            explanation: (r.explanation as string) ?? null,
            recommendation: (r.recommendation as string) ?? null,
          });
        }
      }

      await setStage("synthesis", {
        ingestion: "done",
        parser: "done",
        extractor: "done",
        validator: "done",
        risk: "done",
        synthesis: "running",
      });

      await setDoc(doc(db, `contracts/${contractId}/synthesis`, "latest"), {
        contract_id: contractId,
        summary: (syn.summary as string) ?? null,
        key_insights: (syn.key_insights as any) ?? null,
        recommendations: (syn.recommendations as any) ?? null,
        action_items: (syn.action_items as any) ?? null,
      });

      await updateDoc(runRef, {
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
      });
      await updateDoc(contractRef, { status: "completed" });

      return { run_id: run.id, status: "completed" as const };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await fail(msg);
      throw new Error(msg);
    }
  });

export const getAnalysis = createServerFn({ method: "POST" })
  .middleware([attachFirebaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ contract_id: z.string() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const cid = data.contract_id;
    const [contractSnap, runsSnap, extractionSnap, risksSnap, synthesisSnap] = await Promise.all([
      getDoc(doc(db, "contracts", cid)),
      getDocs(query(
        collection(db, `contracts/${cid}/analysis_runs`),
        orderBy("created_at", "desc"),
        limit(1)
      )),
      getDoc(doc(db, `contracts/${cid}/extractions`, "latest")),
      getDocs(collection(db, `contracts/${cid}/risks`)),
      getDoc(doc(db, `contracts/${cid}/synthesis`, "latest")),
    ]);

    const severityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
    const risks = risksSnap.docs
      .map(doc => doc.data())
      .sort((a, b) => (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3));

    return {
      contract: contractSnap.exists() ? contractSnap.data() : null,
      run: runsSnap.docs[0]?.data() || null,
      extraction: extractionSnap.exists() ? extractionSnap.data() : null,
      risks,
      synthesis: synthesisSnap.exists() ? synthesisSnap.data() : null,
    };
  });
