import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Register a newly uploaded contract (after the client uploads the file to
 * storage) and kick off a multi-agent analysis run.
 */
export const registerContract = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    filename: z.string().min(1).max(255),
    storage_path: z.string().min(1),
    mime: z.string().min(1),
    size: z.number().int().positive().max(20 * 1024 * 1024),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: contract, error } = await supabase.from("contracts").insert({
      user_id: userId,
      filename: data.filename,
      storage_path: data.storage_path,
      mime: data.mime,
      size: data.size,
      status: "pending",
    }).select("id").single();
    if (error || !contract) throw new Error(error?.message ?? "Failed to save contract");
    return { contract_id: contract.id };
  });


export const listContracts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("contracts")
      .select("id, filename, status, size, created_at, synthesis(summary), risks(severity), extractions(parties, confidence)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((c: any) => {
      const risks: Array<{ severity: string }> = c.risks ?? [];
      const counts = { high: 0, medium: 0, low: 0 };
      for (const r of risks) {
        const s = (r.severity ?? "").toLowerCase();
        if (s === "high") counts.high++;
        else if (s === "medium") counts.medium++;
        else if (s === "low") counts.low++;
      }
      const ext = Array.isArray(c.extractions) ? c.extractions[0] : c.extractions;
      const syn = Array.isArray(c.synthesis) ? c.synthesis[0] : c.synthesis;
      const partiesRaw = ext?.parties;
      const parties: string[] = Array.isArray(partiesRaw)
        ? partiesRaw.map((p: any) => (typeof p === "string" ? p : p?.name)).filter(Boolean)
        : [];
      return {
        id: c.id,
        filename: c.filename,
        status: c.status,
        size: c.size,
        created_at: c.created_at,
        summary: syn?.summary ?? null,
        risk_counts: counts,
        parties,
        confidence: ext?.confidence ?? null,
      };
    });
  });

export const deleteContract = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    // Grab storage path first so we can clean up the file.
    const { data: row } = await context.supabase
      .from("contracts").select("storage_path").eq("id", data.id).maybeSingle();
    if (row?.storage_path) {
      await context.supabase.storage.from("contracts").remove([row.storage_path]);
    }
    const { error } = await context.supabase.from("contracts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
