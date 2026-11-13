import { createFileRoute, redirect } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import { Search, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { ParticleField } from "@/components/portal/ParticleField";
import { PortalHeader } from "@/components/portal/PortalHeader";
import { portalQuery } from "@/lib/portal";

const usersQuery = queryOptions({
  queryKey: ["portal-admin-users"],
  queryFn: async () => {
    const { data, error } = await supabase.rpc("admin_list_users");
    if (error) throw error;
    return data ?? [];
  },
});

export const Route = createFileRoute("/_authenticated/portal/admin")({
  head: () => ({ meta: [
    { title: "Administração — Portal Sr. Strix" },
    { name: "description", content: "Gerencie quais sistemas cada pessoa pode acessar." },
    { property: "og:title", content: "Administração — Portal Sr. Strix" },
    { property: "og:description", content: "Gerencie quais sistemas cada pessoa pode acessar." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  loader: async ({ context }) => {
    const p = await context.queryClient.ensureQueryData(portalQuery);
    if (!p.isAdmin) throw redirect({ to: "/portal" });
    await context.queryClient.ensureQueryData(usersQuery);
  },
  component: Admin,
});

const fmt = (d: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(new Date(d));

function Admin() {
  const { data: portal } = useSuspenseQuery(portalQuery);
  const { data: users } = useSuspenseQuery(usersQuery);
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const ctx = gsap.context(() => {
        gsap.from(".a-reveal", { y: 20, opacity: 0, duration: 0.8, stagger: 0.06, ease: "power3.out" });
      }, root);
      return () => ctx.revert();
    });
    return () => mm.revert();
  }, []);

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return users.filter((u) => !t || (u.email ?? "").toLowerCase().includes(t) || (u.display_name ?? "").toLowerCase().includes(t));
  }, [users, q]);

  async function toggle(userId: string, systemId: string, granted: boolean) {
    const key = userId + systemId;
    if (busy) return;
    setBusy(key);
    const { error } = await supabase.rpc("admin_set_access", { p_user: userId, p_system: systemId, p_granted: granted });
    setBusy(null);
    if (error) return toast.error("Não foi possível salvar: " + error.message);
    toast.success(granted ? "Acesso liberado" : "Acesso removido");
    await qc.invalidateQueries({ queryKey: usersQuery.queryKey });
  }

  return (
    <div ref={root} className="relative min-h-screen overflow-hidden bg-portal-bg text-portal-fg">
      <ParticleField className="pointer-events-none fixed inset-0 opacity-40" />
      <PortalHeader email={portal.email} isAdmin />
      <main className="relative z-10 mx-auto w-full max-w-6xl px-5 pb-20 pt-8 sm:px-8 sm:pt-14">
        <p className="a-reveal text-xs uppercase tracking-[0.3em] text-portal-accent">Administração</p>
        <h1 className="a-reveal mt-3 text-3xl font-light tracking-tight sm:text-4xl">Acessos ao portal</h1>
        <p className="a-reveal mt-2 text-sm text-portal-muted">{users.length} pessoas cadastradas. Ative os sistemas que cada uma pode usar.</p>

        <label className="a-reveal mt-8 flex max-w-sm items-center gap-2 rounded-full border border-portal-line bg-portal-card px-4 py-2 focus-within:border-portal-accent">
          <Search className="h-4 w-4 text-portal-muted" aria-hidden />
          <span className="sr-only">Buscar pessoa</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome ou e-mail"
            className="w-full bg-transparent text-sm text-portal-fg placeholder:text-portal-muted focus:outline-none" />
        </label>

        <div className="a-reveal mt-6 overflow-hidden rounded-2xl border border-portal-line bg-portal-card backdrop-blur-md">
          <div className="hidden grid-cols-[1fr_auto] gap-4 border-b border-portal-line px-5 py-3 text-xs uppercase tracking-wider text-portal-muted sm:grid">
            <span>Pessoa</span><span>Sistemas</span>
          </div>
          <ul>
            {list.map((u) => (
              <li key={u.id} className="flex flex-col gap-3 border-b border-portal-line px-5 py-4 last:border-0 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 truncate text-sm font-medium">
                    {u.display_name || u.email}
                    {u.is_admin && <span className="inline-flex items-center gap-1 rounded-full bg-portal-accent/15 px-2 py-0.5 text-[10px] text-portal-accent"><ShieldCheck className="h-3 w-3" aria-hidden />Admin</span>}
                  </p>
                  <p className="truncate text-xs text-portal-muted">{u.email} · desde {fmt(u.created_at)}</p>
                </div>
                <div className="flex flex-wrap gap-4">
                  {portal.systems.map((s) => {
                    const on = u.is_admin || (u.system_ids ?? []).includes(s.id);
                    return (
                      <label key={s.id} className="flex items-center gap-2 text-sm">
                        <Switch checked={on} disabled={u.is_admin || busy === u.id + s.id}
                          onCheckedChange={(v) => toggle(u.id, s.id, v)} aria-label={`${s.name} para ${u.email}`} />
                        <span className={on ? "text-portal-fg" : "text-portal-muted"}>{s.name}</span>
                      </label>
                    );
                  })}
                </div>
              </li>
            ))}
            {list.length === 0 && <li className="px-5 py-10 text-center text-sm text-portal-muted">Ninguém encontrado.</li>}
          </ul>
        </div>
      </main>
    </div>
  );
}
