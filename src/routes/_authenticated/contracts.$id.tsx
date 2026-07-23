import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  ShieldAlert,
  Sparkles,
  FileText,
  Search,
  Workflow,
  MessageSquare,
  FileCheck2,
  AlertCircle,
  Send,
} from "lucide-react";
import { startAnalysis } from "@/lib/agents.functions";
import { askContract } from "@/lib/chat.functions";
import { db, storage } from "@/integrations/firebase/client";
import { doc, getDoc, setDoc, collection, addDoc, getDocs, query, orderBy, limit, deleteDoc, updateDoc } from "firebase/firestore";
import { ref, getBytes } from "firebase/storage";


export const Route = createFileRoute("/_authenticated/contracts/$id")({
  component: ContractDetail,
});

const AGENTS = [
  { key: "ingestion", name: "Ingestion", icon: FileText, desc: "Loading file" },
  { key: "parser", name: "Parser / OCR", icon: Search, desc: "Reading document" },
  { key: "extractor", name: "Extractor", icon: Sparkles, desc: "Pulling clauses" },
  { key: "validator", name: "Validator", icon: FileCheck2, desc: "Checking coverage" },
  { key: "risk", name: "Risk", icon: ShieldAlert, desc: "Flagging concerns" },
  { key: "synthesis", name: "Synthesis", icon: Workflow, desc: "Writing summary" },
] as const;

type AgentKey = (typeof AGENTS)[number]["key"];
type AgentStatus = "queued" | "running" | "done";

function ContractDetail() {
  const { id } = Route.useParams();
  const { user } = Route.useRouteContext();
  const [tab, setTab] = useState<"summary" | "clauses" | "risks" | "chat">("summary");
  const startAnalysisFn = useServerFn(startAnalysis);

  const load = async (cid: string) => {
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
  };

  const { data, isLoading } = useQuery({
    queryKey: ["analysis", id],
    queryFn: () => load(id),
    refetchInterval: (q) => {
      const s = q.state.data?.run?.status;
      return s === "completed" || s === "failed" ? false : 2000;
    },
  });

  const contract = data?.contract;
  const run = data?.run;
  const extraction = data?.extraction;
  const risks = data?.risks ?? [];
  const synthesis = data?.synthesis;

  const startClientAnalysis = async (cid: string) => {
    try {
      await startAnalysisFn({ data: { contract_id: cid } });
    } catch (error) {
      console.error("Analysis failed:", error);
      throw error;
    }
  };


  // Auto-trigger analysis if none has started yet.
  const triggered = useRef(false);
  useEffect(() => {
    if (triggered.current) return;
    if (!contract) return;
    if (run && (run.status === "running" || run.status === "completed")) return;
    triggered.current = true;
    startClientAnalysis(id).catch(() => {});
  }, [contract, run, id]);

  const agentStates = useMemo<Record<AgentKey, AgentStatus>>(() => {
    const raw = (run?.agent_states ?? {}) as Record<string, string>;
    const out: Record<AgentKey, AgentStatus> = {
      ingestion: "queued",
      parser: "queued",
      extractor: "queued",
      validator: "queued",
      risk: "queued",
      synthesis: "queued",
    };
    for (const k of Object.keys(out) as AgentKey[]) {
      const v = raw[k];
      if (v === "running" || v === "done") out[k] = v;
    }
    return out;
  }, [run?.agent_states]);

  const completedCount = AGENTS.filter((a) => agentStates[a.key] === "done").length;
  const isComplete = run?.status === "completed";
  const isFailed = run?.status === "failed";

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <Link
        to="/dashboard"
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to dashboard
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl md:text-4xl">
            {contract?.filename ?? (isLoading ? "Loading…" : "Contract")}
          </h1>
          <div className="mt-1 text-sm text-muted-foreground">
            {contract
              ? `${(contract.size / 1024).toFixed(0)} KB · ${contract.mime}`
              : "\u00A0"}
          </div>
        </div>
        {isComplete && (
          <div className="inline-flex items-center gap-2 rounded-full border border-risk-low/40 bg-risk-low/10 px-3 py-1 text-sm text-risk-low">
            <CheckCircle2 className="h-4 w-4" /> Analysis complete
          </div>
        )}
        {isFailed && (
          <div className="inline-flex items-center gap-2 rounded-full border border-risk-high/40 bg-risk-high/10 px-3 py-1 text-sm text-risk-high">
            <AlertCircle className="h-4 w-4" /> Analysis failed
          </div>
        )}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* Pipeline sidebar */}
        <aside className="rounded-2xl border border-border bg-card p-5 shadow-card lg:sticky lg:top-20 lg:self-start">
          <div className="mb-4 flex items-center justify-between">
            <div className="font-serif text-lg">Agent pipeline</div>
            <div className="text-xs text-muted-foreground">
              {completedCount}/{AGENTS.length}
            </div>
          </div>
          <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full bg-gold transition-all"
              style={{ width: `${(completedCount / AGENTS.length) * 100}%` }}
            />
          </div>
          <div className="space-y-2">
            {AGENTS.map((a) => {
              const status = agentStates[a.key];
              const Icon = a.icon;
              return (
                <div
                  key={a.key}
                  className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition ${
                    status === "done"
                      ? "border-risk-low/30 bg-risk-low/5"
                      : status === "running"
                        ? "border-gold/40 bg-gold/5"
                        : "border-border bg-surface-elevated/40"
                  }`}
                >
                  <div
                    className={`grid h-7 w-7 place-items-center rounded-md ${
                      status === "done"
                        ? "bg-risk-low/20 text-risk-low"
                        : status === "running"
                          ? "bg-gold/20 text-gold"
                          : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {status === "done" ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : status === "running" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div>{a.name}</div>
                    <div className="text-xs text-muted-foreground">{a.desc}</div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {status === "done" ? "Done" : status === "running" ? "…" : "Queued"}
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        {/* Results panel */}
        <section className="min-w-0">
          {isFailed ? (
            <div className="rounded-2xl border border-risk-high/40 bg-risk-high/5 p-10 text-center shadow-card">
              <AlertCircle className="mx-auto h-8 w-8 text-risk-high" />
              <div className="mt-4 font-serif text-2xl">Analysis failed</div>
              <p className="mt-2 text-muted-foreground">
                {run?.error ?? "Something went wrong while analyzing this contract."}
              </p>
              <button
                onClick={() => {
                  triggered.current = false;
                  startClientAnalysis(id).catch(() => {});
                }}
                className="mt-6 rounded-md bg-gold px-4 py-2 text-sm font-medium text-gold-foreground hover:opacity-90"
              >
                Retry analysis
              </button>
            </div>
          ) : !isComplete ? (
            <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-card">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-gold" />
              <div className="mt-4 font-serif text-2xl">Reading your contract…</div>
              <p className="mt-2 text-muted-foreground">
                Each agent runs in sequence. This usually takes 15–30 seconds.
              </p>
              <div className="mx-auto mt-8 max-w-md rounded-lg border border-border bg-surface-elevated p-4 text-left text-xs text-muted-foreground">
                <div className="mb-2 font-mono text-gold">agents.log</div>
                {AGENTS.filter((a) => agentStates[a.key] !== "queued").map((a) => (
                  <div key={a.key} className="font-mono">
                    {agentStates[a.key] === "done" ? "✓" : "→"} {a.key}: {agentStates[a.key]}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="mb-6 flex gap-1 rounded-lg border border-border bg-card p-1">
                {(
                  [
                    ["summary", "Summary"],
                    ["clauses", "Clauses"],
                    ["risks", `Risks${risks.length ? ` (${risks.length})` : ""}`],
                    ["chat", "Ask AI"],
                  ] as const
                ).map(([k, l]) => (
                  <button
                    key={k}
                    onClick={() => setTab(k)}
                    className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
                      tab === k
                        ? "bg-gold text-gold-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>

              {tab === "summary" && (
                <SummaryPanel
                  synthesis={synthesis}
                  extraction={extraction}
                  risksCount={risks.length}
                />
              )}
              {tab === "clauses" && <ClausesPanel extraction={extraction} />}
              {tab === "risks" && <RisksPanel risks={risks} />}
              {tab === "chat" && <ChatPanel contractId={id} />}
            </>
          )}
        </section>
      </div>
    </main>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Presentational helpers

function StatCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-2 font-serif text-4xl text-gradient-gold">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-border bg-surface-elevated/40 p-4 text-sm text-muted-foreground">
      {children}
    </div>
  );
}

function asArray<T = unknown>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function SummaryPanel({
  synthesis,
  extraction,
  risksCount,
}: {
  synthesis: any;
  extraction: any;
  risksCount: number;
}) {
  const insights = asArray<string>(synthesis?.key_insights);
  const recs = asArray<string>(synthesis?.recommendations);
  const actions = asArray<string>(synthesis?.action_items);
  const confidence =
    typeof extraction?.confidence === "number"
      ? `${Math.round(extraction.confidence)}%`
      : "—";
  const obligationsCount = asArray(extraction?.obligations).length;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
        <div className="mb-2 text-xs uppercase tracking-widest text-gold">
          Executive summary
        </div>
        {synthesis?.summary ? (
          <p className="text-lg leading-relaxed">{synthesis.summary}</p>
        ) : (
          <Empty>No summary was generated.</Empty>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Confidence"
          value={confidence}
          hint={
            asArray<string>(extraction?.missing_fields).length
              ? `${asArray<string>(extraction?.missing_fields).length} missing fields`
              : "All key fields extracted"
          }
        />
        <StatCard
          label="Risks flagged"
          value={String(risksCount)}
          hint={risksCount ? "See Risks tab" : "No material risks detected"}
        />
        <StatCard
          label="Obligations"
          value={String(obligationsCount)}
          hint="Across both parties"
        />
      </div>

      {insights.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <div className="mb-3 font-serif text-xl">Key insights</div>
          <ul className="space-y-2 text-sm">
            {insights.map((s, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-gold">•</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {recs.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <div className="mb-3 font-serif text-xl">Recommendations</div>
          <ul className="space-y-2 text-sm">
            {recs.map((s, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-gold">•</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {actions.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <div className="mb-3 font-serif text-xl">Action items</div>
          <ol className="space-y-2 text-sm">
            {actions.map((s, i) => (
              <li key={i} className="flex gap-2">
                <span className="font-mono text-gold">{i + 1}.</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function ClauseCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="text-xs uppercase tracking-widest text-gold">{title}</div>
      <div className="mt-2 text-sm">{children}</div>
    </div>
  );
}

function fmt(v: unknown): string {
  if (v == null || v === "") return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "string" || typeof v === "number") return String(v);
  return JSON.stringify(v);
}

function ClausesPanel({ extraction }: { extraction: any }) {
  if (!extraction) return <Empty>No clauses were extracted from this document.</Empty>;

  const parties = asArray<{ name?: string; role?: string }>(extraction.parties);
  const obligations = asArray<{ party?: string; description?: string }>(
    extraction.obligations,
  );
  const penalties = asArray<{ trigger?: string; amount?: string }>(extraction.penalties);
  const missing = asArray<string>(extraction.missing_fields);

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <ClauseCard title="Parties">
        {parties.length ? (
          <ul className="space-y-1">
            {parties.map((p, i) => (
              <li key={i}>
                <span className="font-medium">{p.name ?? "Unknown"}</span>
                {p.role ? ` — ${p.role}` : ""}
              </li>
            ))}
          </ul>
        ) : (
          "—"
        )}
      </ClauseCard>

      <ClauseCard title="Dates">
        <div>Effective: {fmt(extraction.dates?.effective)}</div>
        <div>Termination: {fmt(extraction.dates?.termination)}</div>
        <div>Signed: {fmt(extraction.dates?.signed)}</div>
      </ClauseCard>

      <ClauseCard title="Payment">
        <div>Amount: {fmt(extraction.payment?.amount)}</div>
        <div>Schedule: {fmt(extraction.payment?.schedule)}</div>
        <div>Terms: {fmt(extraction.payment?.terms)}</div>
      </ClauseCard>

      <ClauseCard title="Termination">
        <div>Notice period: {fmt(extraction.termination?.notice_period)}</div>
        <div>Conditions: {fmt(extraction.termination?.conditions)}</div>
      </ClauseCard>

      <ClauseCard title="Confidentiality">
        <div>Present: {fmt(extraction.confidentiality?.present)}</div>
        <div>Duration: {fmt(extraction.confidentiality?.duration)}</div>
        <div>Scope: {fmt(extraction.confidentiality?.scope)}</div>
      </ClauseCard>

      <ClauseCard title="Renewal">
        <div>Auto-renew: {fmt(extraction.renewal?.auto_renew)}</div>
        <div>Term: {fmt(extraction.renewal?.term)}</div>
        <div>Notice required: {fmt(extraction.renewal?.notice_required)}</div>
      </ClauseCard>

      <ClauseCard title="Obligations">
        {obligations.length ? (
          <ul className="space-y-1">
            {obligations.map((o, i) => (
              <li key={i}>
                <span className="font-medium">{o.party ?? "—"}:</span> {o.description ?? "—"}
              </li>
            ))}
          </ul>
        ) : (
          "—"
        )}
      </ClauseCard>

      <ClauseCard title="Penalties">
        {penalties.length ? (
          <ul className="space-y-1">
            {penalties.map((p, i) => (
              <li key={i}>
                <span className="font-medium">{p.trigger ?? "—"}:</span> {p.amount ?? "—"}
              </li>
            ))}
          </ul>
        ) : (
          "—"
        )}
      </ClauseCard>

      {missing.length > 0 && (
        <div className="sm:col-span-2 rounded-xl border border-risk-medium/30 bg-risk-medium/5 p-5">
          <div className="text-xs uppercase tracking-widest text-risk-medium">
            Missing / uncertain fields
          </div>
          <div className="mt-2 text-sm">{missing.join(", ")}</div>
        </div>
      )}
    </div>
  );
}

function RisksPanel({ risks }: { risks: Array<any> }) {
  if (!risks.length) {
    return (
      <div className="rounded-2xl border border-risk-low/30 bg-risk-low/5 p-10 text-center">
        <CheckCircle2 className="mx-auto h-8 w-8 text-risk-low" />
        <div className="mt-3 font-serif text-xl">No material risks flagged</div>
        <p className="mt-1 text-sm text-muted-foreground">
          The extractor did not find high-priority concerns in this contract.
        </p>
      </div>
    );
  }
  const cls = (s: string) =>
    s === "high"
      ? "border-risk-high/40 bg-risk-high/10 text-risk-high"
      : s === "medium"
        ? "border-risk-medium/40 bg-risk-medium/10 text-risk-medium"
        : "border-risk-low/40 bg-risk-low/10 text-risk-low";
  return (
    <div className="space-y-3">
      {risks.map((r) => (
        <div key={r.id} className={`rounded-xl border p-5 ${cls(r.severity)}`}>
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4" />
            <span className="text-xs uppercase tracking-widest">
              {r.severity} · {r.category}
            </span>
          </div>
          {r.clause_text && (
            <blockquote className="mt-3 border-l-2 border-current/40 pl-3 text-sm italic text-foreground/90">
              “{r.clause_text}”
            </blockquote>
          )}
          {r.explanation && (
            <p className="mt-2 text-sm text-foreground">{r.explanation}</p>
          )}
          {r.recommendation && (
            <div className="mt-3 rounded-md bg-surface-elevated p-3 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Recommendation: </span>
              {r.recommendation}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

const SUGGESTED = [
  "What are the key termination conditions?",
  "Summarize the payment terms.",
  "What are the biggest risks I should negotiate?",
  "When does this contract auto-renew?",
];

function ChatPanel({ contractId }: { contractId: string }) {
  const qc = useQueryClient();
  const askFn = useServerFn(askContract);
  const { user } = Route.useRouteContext();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["chat", contractId],
    queryFn: async () => {
      const q = query(collection(db, `contracts/${contractId}/chat_messages`), orderBy("created_at", "asc"));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        role: doc.data().role,
        content: doc.data().content,
        created_at: doc.data().created_at,
      }));
    }
  });

  const ask = useMutation({
    mutationFn: async (question: string) => {
      const [extractionSnap, synthesisSnap, risksSnap, historySnap] = await Promise.all([
        getDoc(doc(db, `contracts/${contractId}/extractions`, "latest")),
        getDoc(doc(db, `contracts/${contractId}/synthesis`, "latest")),
        getDocs(collection(db, `contracts/${contractId}/risks`)),
        getDocs(query(
          collection(db, `contracts/${contractId}/chat_messages`),
          orderBy("created_at", "asc"),
          limit(20)
        )),
      ]);

      const extraction = extractionSnap.exists() ? extractionSnap.data() : null;
      const synthesis = synthesisSnap.exists() ? synthesisSnap.data() : null;
      const risks = risksSnap.docs.map(doc => doc.data());
      const history = historySnap.docs.map(doc => ({
        role: doc.data().role,
        content: doc.data().content,
      }));

      await addDoc(collection(db, `contracts/${contractId}/chat_messages`), {
        contract_id: contractId,
        user_id: user.id,
        role: "user",
        content: question,
        created_at: new Date().toISOString(),
      });

      const contextJson = JSON.stringify(
        { extraction, synthesis, risks },
        null,
        2
      ).slice(0, 60_000);

      const historyFormatted = history.map((m) => ({
        role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
        content: m.content,
      }));

      const { answer } = await askFn({ data: { question, contextJson, history: historyFormatted } });

      await addDoc(collection(db, `contracts/${contractId}/chat_messages`), {
        contract_id: contractId,
        user_id: user.id,
        role: "assistant",
        content: answer,
        created_at: new Date().toISOString(),
      });
    },
    onMutate: () => {
      qc.setQueryData(["chat", contractId], (prev: any[] = []) => [
        ...prev,
        {
          id: `optimistic-${Date.now()}`,
          role: "user",
          content: input,
          created_at: new Date().toISOString(),
        },
      ]);
      setInput("");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chat", contractId] }),
    onError: (e) => {
      qc.invalidateQueries({ queryKey: ["chat", contractId] });
      toast.error(e instanceof Error ? e.message : "Failed to get an answer");
    },
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, ask.isPending]);

  const submit = (q?: string) => {
    const text = (q ?? input).trim();
    if (!text || ask.isPending) return;
    if (!q) setInput("");
    ask.mutate(text);
  };

  return (
    <div className="flex h-[70vh] min-h-[500px] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      <div className="flex items-center gap-2 border-b border-border px-5 py-3">
        <MessageSquare className="h-5 w-5 text-gold" />
        <div className="font-serif text-lg">Ask this contract anything</div>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="mx-auto max-w-md text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-accent text-gold">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="mt-3 font-serif text-xl">Ask about clauses, risks, or terms</div>
            <p className="mt-1 text-sm text-muted-foreground">
              Answers are grounded in the analysis we just ran on your contract.
            </p>
            <div className="mt-5 grid gap-2">
              {SUGGESTED.map((s) => (
                <button
                  key={s}
                  onClick={() => submit(s)}
                  className="rounded-lg border border-border bg-surface-elevated/40 px-3 py-2 text-left text-sm text-foreground/90 transition hover:border-gold/40 hover:bg-accent/30"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => <ChatBubble key={m.id} role={m.role} content={m.content} />)
        )}
        {ask.isPending && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-gold" />
            Thinking…
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex items-end gap-2 border-t border-border bg-surface-elevated/30 px-4 py-3"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          rows={1}
          placeholder="Ask a question about this contract…"
          className="max-h-40 min-h-[40px] flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-gold"
          disabled={ask.isPending}
        />
        <button
          type="submit"
          disabled={ask.isPending || !input.trim()}
          className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-gold px-4 text-sm font-medium text-gold-foreground transition hover:opacity-90 disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
          Send
        </button>
      </form>
    </div>
  );
}

function ChatBubble({ role, content }: { role: string; content: string }) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
          isUser
            ? "bg-gold text-gold-foreground"
            : "border border-border bg-surface-elevated text-foreground"
        }`}
      >
        {isUser ? (
          <div className="whitespace-pre-wrap">{content}</div>
        ) : (
          <div className="prose prose-sm prose-invert max-w-none prose-p:my-1.5 prose-headings:font-serif prose-strong:text-gold">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
