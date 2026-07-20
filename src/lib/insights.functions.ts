import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getInsights = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [contractsRes, risksRes, extractionsRes, synthesisRes] = await Promise.all([
      supabase.from("contracts").select("id, filename, status, created_at").eq("user_id", userId),
      supabase.from("risks").select("id, contract_id, severity, category, explanation, recommendation, clause_text, created_at, contracts!inner(user_id, filename)").eq("contracts.user_id", userId),
      supabase.from("extractions").select("contract_id, obligations, dates, renewal, confidence, missing_fields, contracts!inner(user_id, filename)").eq("contracts.user_id", userId),
      supabase.from("synthesis").select("contract_id, summary, key_insights, action_items, contracts!inner(user_id, filename)").eq("contracts.user_id", userId),
    ]);

    const contracts = contractsRes.data ?? [];
    const risks = (risksRes.data ?? []) as any[];
    const extractions = (extractionsRes.data ?? []) as any[];
    const synthesis = (synthesisRes.data ?? []) as any[];

    const total = contracts.length;
    const completed = contracts.filter((c) => c.status === "completed").length;
    const analyzing = contracts.filter((c) => c.status === "analyzing" || c.status === "pending").length;
    const failed = contracts.filter((c) => c.status === "failed").length;

    // Risk heatmap: rows = contract, cols = category → severity
    const categoriesSet = new Set<string>();
    const heatmapMap = new Map<string, { contract_id: string; filename: string; cells: Record<string, string> }>();
    for (const r of risks) {
      const cat: string = r.category || "Other";
      categoriesSet.add(cat);
      const key: string = r.contract_id;
      const fname: string = r.contracts?.filename ?? "Contract";
      const row = heatmapMap.get(key) ?? { contract_id: key, filename: fname, cells: {} as Record<string, string> };
      const rank = (s: string) => (s === "high" ? 3 : s === "medium" ? 2 : s === "low" ? 1 : 0);
      const prev = row.cells[cat];
      if (rank(r.severity) > rank(prev)) row.cells[cat] = r.severity;
      heatmapMap.set(key, row);
    }
    const categories = Array.from(categoriesSet).sort();
    const heatmap = Array.from(heatmapMap.values());

    // Risk distribution
    const severityCounts = { high: 0, medium: 0, low: 0 };
    for (const r of risks) {
      const s = (r.severity || "").toLowerCase();
      if (s === "high") severityCounts.high++;
      else if (s === "medium") severityCounts.medium++;
      else if (s === "low") severityCounts.low++;
    }

    // Clause distribution: count category occurrences
    const clauseCounts: Record<string, number> = {};
    for (const r of risks) {
      const cat = r.category || "Other";
      clauseCounts[cat] = (clauseCounts[cat] ?? 0) + 1;
    }
    const clauseDistribution = Object.entries(clauseCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    // Obligation timeline: flatten obligations with any dates from extractions
    const timeline: Array<{ contract_id: string; filename: string; date: string | null; party: string; description: string }> = [];
    for (const e of extractions) {
      const fname = e.contracts?.filename ?? "Contract";
      const obligations = Array.isArray(e.obligations) ? e.obligations : [];
      for (const o of obligations) {
        timeline.push({
          contract_id: e.contract_id,
          filename: fname,
          date: o?.due_date ?? o?.date ?? e.dates?.termination ?? e.dates?.effective ?? null,
          party: o?.party ?? "—",
          description: o?.description ?? String(o ?? ""),
        });
      }
    }

    // Average confidence
    const confidences = extractions.map((e) => e.confidence).filter((n: any) => typeof n === "number");
    const avgConfidence = confidences.length ? Math.round(confidences.reduce((a: number, b: number) => a + b, 0) / confidences.length) : null;

    // Recent summaries
    const summaries = synthesis
      .map((s) => ({
        contract_id: s.contract_id,
        filename: s.contracts?.filename ?? "Contract",
        summary: s.summary ?? "",
        key_insights: Array.isArray(s.key_insights) ? s.key_insights.slice(0, 3) : [],
      }))
      .filter((s) => s.summary)
      .slice(0, 6);

    return {
      metrics: {
        total,
        completed,
        analyzing,
        failed,
        risks_total: risks.length,
        risks_high: severityCounts.high,
        avg_confidence: avgConfidence,
      },
      severityCounts,
      categories,
      heatmap,
      clauseDistribution,
      timeline: timeline.slice(0, 20),
      summaries,
    };
  });
