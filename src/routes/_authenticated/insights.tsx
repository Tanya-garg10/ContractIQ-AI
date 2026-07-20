import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getInsights } from "@/lib/insights.functions";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { FileText, ShieldAlert, CheckCircle2, Gauge, Loader2, Calendar, Download, FileSpreadsheet } from "lucide-react";

export const Route = createFileRoute("/_authenticated/insights")({
  component: InsightsPage,
});

function InsightsPage() {
  const fn = useServerFn(getInsights);
  const { data, isLoading } = useQuery({
    queryKey: ["insights"],
    queryFn: () => fn(),
  });

  if (isLoading || !data) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </main>
    );
  }

  const { metrics, categories, heatmap, clauseDistribution, timeline, summaries, severityCounts } = data;

  const severityPie = [
    { name: "High", value: severityCounts.high, color: "var(--risk-high)" },
    { name: "Medium", value: severityCounts.medium, color: "var(--risk-medium)" },
    { name: "Low", value: severityCounts.low, color: "var(--risk-low)" },
  ].filter((s) => s.value > 0);

  const exportCSV = () => {
    const rows: string[][] = [];
    rows.push(["ContractIQ AI — Insights export", new Date().toLocaleString()]);
    rows.push([]);
    rows.push(["Key metrics"]);
    rows.push(["Total contracts", String(metrics.total)]);
    rows.push(["Completed", String(metrics.completed)]);
    rows.push(["Analyzing / pending", String(metrics.analyzing)]);
    rows.push(["Failed", String(metrics.failed)]);
    rows.push(["Total risks", String(metrics.risks_total)]);
    rows.push(["High-risk flags", String(metrics.risks_high)]);
    rows.push(["Avg. confidence", metrics.avg_confidence != null ? `${metrics.avg_confidence}%` : "—"]);
    rows.push([]);
    rows.push(["Risk severity distribution"]);
    rows.push(["High", String(severityCounts.high)]);
    rows.push(["Medium", String(severityCounts.medium)]);
    rows.push(["Low", String(severityCounts.low)]);
    rows.push([]);
    rows.push(["Clause distribution"]);
    rows.push(["Category", "Count"]);
    for (const c of clauseDistribution) rows.push([c.name, String(c.value)]);
    rows.push([]);
    rows.push(["Risk heatmap"]);
    rows.push(["Contract", ...categories]);
    for (const row of heatmap) rows.push([row.filename, ...categories.map((c) => row.cells[c] ?? "")]);
    rows.push([]);
    rows.push(["Obligation timeline"]);
    rows.push(["Date", "Contract", "Party", "Description"]);
    for (const t of timeline) rows.push([t.date ?? "", t.filename, t.party, t.description]);
    rows.push([]);
    rows.push(["Document summaries"]);
    rows.push(["Contract", "Summary"]);
    for (const s of summaries) rows.push([s.filename, s.summary]);

    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contractiq-insights-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => window.print();

  return (
    <main className="mx-auto max-w-7xl px-6 py-10 print:py-0">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl md:text-5xl">Insights</h1>
          <p className="mt-2 text-muted-foreground">Portfolio-level view across every contract you've analyzed.</p>
        </div>
        <div className="flex gap-2 print:hidden">
          <button
            onClick={exportCSV}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-elevated px-3 py-2 text-sm hover:bg-secondary"
          >
            <FileSpreadsheet className="h-4 w-4" /> Export CSV
          </button>
          <button
            onClick={exportPDF}
            className="inline-flex items-center gap-1.5 rounded-md bg-gold px-3 py-2 text-sm font-medium text-gold-foreground hover:opacity-90"
          >
            <Download className="h-4 w-4" /> Export PDF
          </button>
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric icon={FileText} label="Total contracts" value={metrics.total} />
        <Metric icon={CheckCircle2} label="Completed" value={metrics.completed} accent="text-risk-low" />
        <Metric icon={ShieldAlert} label="High-risk flags" value={metrics.risks_high} accent="text-risk-high" />
        <Metric icon={Gauge} label="Avg. confidence" value={metrics.avg_confidence != null ? `${metrics.avg_confidence}%` : "—"} />
      </div>

      {metrics.total === 0 && (
        <div className="mt-10 rounded-xl border border-dashed border-border bg-card/50 p-12 text-center text-muted-foreground">
          Nothing to show yet. <Link to="/dashboard" className="text-gold underline underline-offset-4">Upload a contract</Link> to see insights.
        </div>
      )}

      {metrics.total > 0 && (
        <>
          {/* Risk distribution + Clause distribution */}
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <Card title="Risk severity distribution">
              {severityPie.length === 0 ? (
                <Empty>No risks detected yet.</Empty>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={severityPie} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                        {severityPie.map((s) => <Cell key={s.name} fill={s.color} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: "var(--surface-elevated)", border: "1px solid var(--border)", borderRadius: 8 }} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>

            <Card title="Clause distribution">
              {clauseDistribution.length === 0 ? (
                <Empty>No clause categories yet.</Empty>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={clauseDistribution} layout="vertical" margin={{ left: 20, right: 12 }}>
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="name" width={140} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
                      <Tooltip contentStyle={{ background: "var(--surface-elevated)", border: "1px solid var(--border)", borderRadius: 8 }} />
                      <Bar dataKey="value" fill="var(--gold)" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>
          </div>

          {/* Risk heatmap */}
          <Card title="Risk heatmap" className="mt-6">
            {heatmap.length === 0 ? (
              <Empty>No risks to plot.</Empty>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr>
                      <th className="sticky left-0 bg-card px-3 py-2 text-left font-medium text-muted-foreground">Contract</th>
                      {categories.map((c) => (
                        <th key={c} className="px-2 py-2 text-center text-xs font-medium text-muted-foreground">{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {heatmap.map((row) => (
                      <tr key={row.contract_id} className="border-t border-border">
                        <td className="sticky left-0 bg-card px-3 py-2">
                          <Link to="/contracts/$id" params={{ id: row.contract_id }} className="truncate hover:text-gold">
                            {row.filename}
                          </Link>
                        </td>
                        {categories.map((c) => {
                          const sev = row.cells[c];
                          return (
                            <td key={c} className="px-2 py-2 text-center">
                              <HeatCell sev={sev} />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                  <LegendDot color="bg-risk-high" label="High" />
                  <LegendDot color="bg-risk-medium" label="Medium" />
                  <LegendDot color="bg-risk-low" label="Low" />
                  <LegendDot color="bg-secondary" label="None" />
                </div>
              </div>
            )}
          </Card>

          {/* Obligation timeline + Summaries */}
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Card title="Obligation timeline">
              {timeline.length === 0 ? (
                <Empty>No obligations extracted yet.</Empty>
              ) : (
                <ol className="relative space-y-4 border-l border-border pl-5">
                  {timeline.map((t, i) => (
                    <li key={i} className="relative">
                      <span className="absolute -left-[27px] top-1 grid h-5 w-5 place-items-center rounded-full bg-accent text-gold">
                        <Calendar className="h-3 w-3" />
                      </span>
                      <div className="text-xs text-muted-foreground">
                        {t.date ?? "No date"} · <Link to="/contracts/$id" params={{ id: t.contract_id }} className="hover:text-gold">{t.filename}</Link>
                      </div>
                      <div className="text-sm">
                        <span className="font-medium text-foreground/90">{t.party}:</span> {t.description}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </Card>

            <Card title="Document summaries">
              {summaries.length === 0 ? (
                <Empty>No summaries yet.</Empty>
              ) : (
                <div className="space-y-4">
                  {summaries.map((s) => (
                    <div key={s.contract_id} className="rounded-lg border border-border p-4">
                      <Link to="/contracts/$id" params={{ id: s.contract_id }} className="font-medium hover:text-gold">
                        {s.filename}
                      </Link>
                      <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{s.summary}</p>
                      {s.key_insights.length > 0 && (
                        <ul className="mt-2 list-inside list-disc space-y-0.5 text-xs text-foreground/80">
                          {s.key_insights.map((k: string, i: number) => <li key={i}>{k}</li>)}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </main>
  );
}

function Metric({ icon: Icon, label, value, accent }: { icon: any; label: string; value: any; accent?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        <Icon className={`h-4 w-4 ${accent ?? "text-gold"}`} /> {label}
      </div>
      <div className="mt-2 font-serif text-3xl">{value}</div>
    </div>
  );
}

function Card({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-border bg-card p-5 ${className ?? ""}`}>
      <h2 className="mb-4 font-serif text-xl">{title}</h2>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="py-8 text-center text-sm text-muted-foreground">{children}</div>;
}

function HeatCell({ sev }: { sev?: string }) {
  const cls =
    sev === "high" ? "bg-risk-high" :
    sev === "medium" ? "bg-risk-medium" :
    sev === "low" ? "bg-risk-low" :
    "bg-secondary";
  return <span className={`inline-block h-6 w-10 rounded ${cls}`} title={sev ?? "none"} />;
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-3 w-3 rounded ${color}`} /> {label}
    </span>
  );
}
