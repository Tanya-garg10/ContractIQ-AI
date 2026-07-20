import { createFileRoute, Outlet, redirect, Link, useNavigate } from "@tanstack/react-router";
import { auth, db } from "@/integrations/firebase/client";
import { useEffect, useState } from "react";
import { LogOut, LayoutDashboard, BarChart3 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    return new Promise((resolve, reject) => {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        unsubscribe();
        if (!user) {
          reject(redirect({ to: "/auth" }));
        } else {
          resolve({ user: { id: user.uid, email: user.email, displayName: user.displayName } });
        }
      });
    });
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState<string>(user.email ?? "");

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const profileRef = doc(db, "profiles", user.id);
        const profileSnap = await getDoc(profileRef);
        if (profileSnap.exists()) {
          const profileData = profileSnap.data();
          if (profileData.full_name) setDisplayName(profileData.full_name);
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
      }
    };
    fetchProfile();
  }, [user.id]);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await firebaseSignOut(auth);
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
