import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, FileText, Search, ShieldAlert, Sparkles, Workflow, MessageSquare, FileCheck2 } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
});

const AGENTS = [
  { name: "Ingestion", desc: "Detects file type & routes for parsing", icon: FileText },
  { name: "Parser / OCR", desc: "Extracts text from PDFs, DOCX & scans", icon: Search },
  { name: "Extractor", desc: "Structures parties, dates, obligations, penalties", icon: Sparkles },
  { name: "Validator", desc: "Scores confidence, flags missing fields", icon: FileCheck2 },
  { name: "Risk", desc: "Detects one-sided clauses, auto-renewal, compliance", icon: ShieldAlert },
  { name: "Synthesis", desc: "Executive summary + recommendations", icon: Workflow },
  { name: "Q&A", desc: "Answer any question with cited sources", icon: MessageSquare },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-gold text-gold-foreground font-serif text-lg">C</div>
            <span className="font-serif text-lg">ContractIQ<span className="text-gold"> AI</span></span>
          </Link>
          <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
            <a href="#agents" className="hover:text-foreground">Agents</a>
            <a href="#how" className="hover:text-foreground">How it works</a>
            <a href="#features" className="hover:text-foreground">Features</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/auth" className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground">
              Sign in
            </Link>
            <Link to="/auth" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="gradient-hero relative overflow-hidden">
        <div className="mx-auto max-w-6xl px-6 py-24 md:py-32">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-gold" />
              Powered by a team of AI agents
            </div>
            <h1 className="font-serif text-5xl leading-[1.05] md:text-7xl">
              Your contracts, <span className="text-gradient-gold italic">understood.</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground md:text-xl">
              Upload any contract. Seven specialized AI agents extract every clause,
              flag every risk, and answer every question — with citations.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <Link to="/auth" className="group inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 font-medium text-primary-foreground shadow-glow hover:opacity-90">
                Analyze a contract
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </Link>
              <a href="#agents" className="rounded-md border border-border bg-surface/60 px-6 py-3 text-foreground backdrop-blur hover:bg-secondary">
                See the agents
              </a>
            </div>
            <p className="mt-6 text-xs text-muted-foreground">PDF · DOCX · scanned images · up to 20MB</p>
          </div>
        </div>
      </section>

      {/* Agents grid */}
      <section id="agents" className="mx-auto max-w-6xl px-6 py-24">
        <div className="mb-14 max-w-2xl">
          <p className="text-sm uppercase tracking-widest text-gold">Multi-agent pipeline</p>
          <h2 className="mt-3 font-serif text-4xl md:text-5xl">Seven agents. One workflow.</h2>
          <p className="mt-4 text-muted-foreground">
            Every upload flows through a coordinated pipeline — each agent an expert at its step,
            passing structured context downstream.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {AGENTS.map((a, i) => {
            const Icon = a.icon;
            return (
              <div key={a.name} className="group relative rounded-xl border border-border bg-card p-6 shadow-card transition hover:border-gold/40">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent text-gold">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="text-xs text-muted-foreground">Agent {String(i + 1).padStart(2, "0")}</div>
                </div>
                <h3 className="mt-5 font-serif text-2xl">{a.name}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{a.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-y border-border bg-surface/40">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <div className="grid gap-16 md:grid-cols-2 md:items-center">
            <div>
              <p className="text-sm uppercase tracking-widest text-gold">How it works</p>
              <h2 className="mt-3 font-serif text-4xl md:text-5xl">From upload to insight in under a minute.</h2>
              <ol className="mt-8 space-y-6">
                {[
                  { t: "Upload", d: "Drag any PDF, DOCX, or scanned contract into your dashboard." },
                  { t: "Watch agents work", d: "Live status shows each agent as it parses, extracts, validates, and scores risk." },
                  { t: "Explore results", d: "Structured clauses, color-coded risks, executive summary, and an obligation timeline." },
                  { t: "Ask anything", d: "Chat with your contract. Every answer carries source citations." },
                ].map((s, i) => (
                  <li key={s.t} className="flex gap-4">
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-gold/40 text-gold font-serif">
                      {i + 1}
                    </div>
                    <div>
                      <div className="font-medium">{s.t}</div>
                      <div className="text-sm text-muted-foreground">{s.d}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
              <div className="mb-4 flex items-center justify-between text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-2">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-gold" />
                  Analyzing MSA_v3.pdf
                </span>
                <span>00:42</span>
              </div>
              <div className="space-y-3">
                {[
                  { name: "Ingestion", status: "done" },
                  { name: "Parser / OCR", status: "done" },
                  { name: "Extractor", status: "done" },
                  { name: "Validator", status: "done" },
                  { name: "Risk", status: "running" },
                  { name: "Synthesis", status: "queued" },
                ].map((row) => (
                  <div key={row.name} className="flex items-center justify-between rounded-lg border border-border bg-surface-elevated px-4 py-3">
                    <span className="text-sm">{row.name}</span>
                    <span className={
                      row.status === "done" ? "text-xs text-risk-low" :
                      row.status === "running" ? "text-xs text-gold" :
                      "text-xs text-muted-foreground"
                    }>
                      {row.status === "done" ? "Completed" : row.status === "running" ? "Running..." : "Queued"}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-6 rounded-lg border border-risk-high/30 bg-risk-high/10 p-4 text-sm">
                <div className="flex items-center gap-2 text-risk-high">
                  <ShieldAlert className="h-4 w-4" /> High-risk clause detected
                </div>
                <p className="mt-1 text-muted-foreground">
                  Auto-renewal with 90-day notice window — one-sided in favor of vendor.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-24">
        <div className="mb-14 max-w-2xl">
          <p className="text-sm uppercase tracking-widest text-gold">Built for negotiators</p>
          <h2 className="mt-3 font-serif text-4xl md:text-5xl">Everything you need before you sign.</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[
            { t: "Side-by-side compare", d: "Diff two contract versions clause by clause." },
            { t: "Color-coded risk", d: "High / medium / low severity badges on every flagged clause." },
            { t: "Obligation timeline", d: "Every deadline and deliverable on one visual timeline." },
            { t: "Source citations", d: "Every AI answer links back to the exact clause." },
            { t: "Multi-language", d: "Analyze contracts in dozens of languages." },
            { t: "Negotiation suggestions", d: "AI-drafted redlines with rationale." },
          ].map((f) => (
            <div key={f.t} className="rounded-xl border border-border bg-card p-6">
              <h3 className="font-serif text-xl">{f.t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-4xl px-6 pb-24">
        <div className="gradient-hero rounded-3xl border border-border p-12 text-center shadow-card">
          <h2 className="font-serif text-4xl md:text-5xl">Ready to read smarter?</h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Sign up in seconds. Analyze your first contract for free.
          </p>
          <Link to="/auth" className="mt-8 inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 font-medium text-primary-foreground shadow-glow hover:opacity-90">
            Get started free <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-muted-foreground md:flex-row">
          <div>© {new Date().getFullYear()} ContractIQ AI</div>
          <div className="italic font-serif">Contracts, read intelligently.</div>
        </div>
      </footer>
    </div>
  );
}
