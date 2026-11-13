import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, Shield, LayoutGrid } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import logoAsset from "@/assets/sr-strix-logo.png.asset.json";

export function PortalHeader({ email, isAdmin }: { email?: string; isAdmin: boolean }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", search: { redirect: "" }, replace: true });
  }
  const btn = "inline-flex items-center gap-2 rounded-full border border-portal-line px-3 py-1.5 text-xs text-portal-muted transition hover:border-portal-accent hover:text-portal-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-accent";
  return (
    <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
      <Link to="/portal" aria-label="Início do portal">
        <img src={logoAsset.url} alt="Sr. Strix" className="h-10 w-auto object-contain" />
      </Link>
      <div className="flex items-center gap-2">
        <span className="hidden text-xs text-portal-muted md:inline">{email}</span>
        <Link to="/portal" preload="intent" className={btn}><LayoutGrid className="h-3.5 w-3.5" aria-hidden /><span className="hidden sm:inline">Sistemas</span></Link>
        {isAdmin && <Link to="/portal/admin" preload="intent" className={btn}><Shield className="h-3.5 w-3.5" aria-hidden /><span className="hidden sm:inline">Admin</span></Link>}
        <button onClick={signOut} className={btn}><LogOut className="h-3.5 w-3.5" aria-hidden /><span className="hidden sm:inline">Sair</span></button>
      </div>
    </header>
  );
}
