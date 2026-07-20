import { createFileRoute, Outlet, redirect, Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { LogOut, LayoutDashboard, BarChart3 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState<string>(user.email ?? "");

  useEffect(() => {
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle()
      .then(({ data }) => { if (data?.full_name) setDisplayName(data.full_name); });
  }, [user.id]);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-gold text-gold-foreground font-serif">C</div>
            <span className="font-serif text-lg">ContractIQ<span className="text-gold"> AI</span></span>
          </Link>
          <nav className="hidden gap-6 text-sm md:flex">
            <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
              <LayoutDashboard className="h-4 w-4" /> Dashboard
            </Link>
            <Link to="/insights" className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
              <BarChart3 className="h-4 w-4" /> Insights
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <div className="hidden text-right text-xs sm:block">
              <div className="text-muted-foreground">Signed in as</div>
              <div className="font-medium">{displayName}</div>
            </div>
            <button
              onClick={signOut}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-elevated px-3 py-2 text-sm hover:bg-secondary"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
