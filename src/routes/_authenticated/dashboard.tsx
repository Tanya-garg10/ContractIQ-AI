import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { Upload, FileText, Trash2, Loader2, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { storage } from "@/integrations/firebase/client";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { registerContract, listContracts, deleteContract } from "@/lib/contracts.functions";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

const ACCEPT = ".pdf,.docx,.doc,.png,.jpg,.jpeg,.webp";
const MAX_SIZE = 20 * 1024 * 1024;

function Dashboard() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const list = useServerFn(listContracts);
  const register = useServerFn(registerContract);
  const del = useServerFn(deleteContract);

  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ["contracts"],
    queryFn: () => list(),
  });

  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const deleteMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["contracts"] }); toast.success("Contract deleted"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Delete failed"),
  });

  const handleFile = useCallback(async (file: File) => {
    if (file.size > MAX_SIZE) {
      toast.error("File too large (max 20MB)");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `contracts/${user.id}/${crypto.randomUUID()}.${ext}`;
      const storageRef = ref(storage, path);
      
      await uploadBytes(storageRef, file, {
        contentType: file.type || "application/octet-stream",
      });

      const { contract_id } = await register({ data: {
        filename: file.name,
        storage_path: path,
        mime: file.type || "application/octet-stream",
        size: file.size,
      }});

      qc.invalidateQueries({ queryKey: ["contracts"] });
      toast.success("Upload complete — starting analysis");
      navigate({ to: "/contracts/$id", params: { id: contract_id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }, [user.id, register, qc, navigate]);

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <div className="mb-8">
        <h1 className="font-serif text-4xl md:text-5xl">Your contracts</h1>
        <p className="mt-2 text-muted-foreground">Upload a contract to run the AI agent pipeline.</p>
      </div>

      {/* Upload zone */}
      <label
        htmlFor="contract-upload"
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files[0];
          if (f) handleFile(f);
        }}
        className={`group flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-12 text-center transition ${
          dragOver ? "border-gold bg-accent/30" : "border-border bg-card hover:border-gold/50"
        } ${uploading ? "pointer-events-none opacity-60" : ""}`}
      >
        <input
          id="contract-upload"
          ref={fileRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
        <div className="grid h-14 w-14 place-items-center rounded-full bg-accent text-gold">
          {uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6" />}
        </div>
        <div>
          <div className="font-serif text-xl">{uploading ? "Uploading..." : "Drop a contract here"}</div>
          <div className="mt-1 text-sm text-muted-foreground">
            or click to browse · PDF, DOCX, images · up to 20MB
          </div>
        </div>
      </label>

      {/* Contract list */}
      <div className="mt-10">
        <h2 className="mb-4 font-serif text-2xl">Recent</h2>
        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : contracts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center text-muted-foreground">
            No contracts yet. Upload your first one above.
          </div>
        ) : (
          <div className="grid gap-3">
            {contracts.map((c) => (
              <div key={c.id} className="group flex items-start gap-4 rounded-xl border border-border bg-card p-4 transition hover:border-gold/40">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-accent text-gold">
                  <FileText className="h-5 w-5" />
                </div>
                <Link to="/contracts/$id" params={{ id: c.id }} className="min-w-0 flex-1">
                  <div className="truncate font-medium">{c.filename}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <StatusBadge status={c.status} />
                    <span>{(c.size / 1024).toFixed(0)} KB</span>
                    <span>{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</span>
                    {c.confidence != null && <span>Confidence {Math.round(c.confidence * 100)}%</span>}
                  </div>
                  {c.parties && c.parties.length > 0 && (
                    <div className="mt-1.5 truncate text-xs text-muted-foreground">
                      <span className="text-foreground/70">Parties:</span> {c.parties.join(" · ")}
                    </div>
                  )}
                  {c.summary && (
                    <p className="mt-2 line-clamp-2 text-sm text-foreground/80">{c.summary}</p>
                  )}
                  {(c.risk_counts.high + c.risk_counts.medium + c.risk_counts.low) > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {c.risk_counts.high > 0 && (
                        <span className="rounded-full bg-risk-high/15 px-2 py-0.5 text-[11px] font-medium text-risk-high">
                          {c.risk_counts.high} High
                        </span>
                      )}
                      {c.risk_counts.medium > 0 && (
                        <span className="rounded-full bg-risk-medium/15 px-2 py-0.5 text-[11px] font-medium text-risk-medium">
                          {c.risk_counts.medium} Medium
                        </span>
                      )}
                      {c.risk_counts.low > 0 && (
                        <span className="rounded-full bg-risk-low/15 px-2 py-0.5 text-[11px] font-medium text-risk-low">
                          {c.risk_counts.low} Low
                        </span>
                      )}
                    </div>
                  )}
                </Link>
                <button
                  onClick={() => { if (confirm("Delete this contract?")) deleteMut.mutate(c.id); }}
                  className="rounded-md p-2 text-muted-foreground opacity-0 transition hover:bg-secondary hover:text-destructive group-hover:opacity-100"
                  aria-label="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { icon: typeof Clock; label: string; cls: string }> = {
    pending: { icon: Clock, label: "Pending", cls: "text-muted-foreground" },
    analyzing: { icon: Loader2, label: "Analyzing", cls: "text-gold" },
    completed: { icon: CheckCircle2, label: "Completed", cls: "text-risk-low" },
    failed: { icon: AlertCircle, label: "Failed", cls: "text-risk-high" },
  };
  const s = map[status] ?? map.pending;
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1 ${s.cls}`}>
      <Icon className={`h-3 w-3 ${status === "analyzing" ? "animate-spin" : ""}`} /> {s.label}
    </span>
  );
}
