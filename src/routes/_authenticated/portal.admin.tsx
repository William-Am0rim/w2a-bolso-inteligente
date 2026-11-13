import { createFileRoute, redirect } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import { Pencil, Plus, Search, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ParticleField } from "@/components/portal/ParticleField";
import { PortalHeader } from "@/components/portal/PortalHeader";
import { portalQuery } from "@/lib/portal";
import { adminCreateUser, adminDeleteUser, adminUpdateUser } from "@/lib/admin-users.functions";

const usersQuery = queryOptions({
  queryKey: ["portal-admin-users"],
  queryFn: async () => {
    const { data, error } = await supabase.rpc("admin_list_users");
    if (error) throw error;
    return data ?? [];
  },
});
const systemsQuery = queryOptions({
  queryKey: ["portal-admin-systems"],
  queryFn: async () => {
    const { data, error } = await supabase.from("portal_systems").select("*").order("sort_order");
    if (error) throw error;
    return data ?? [];
  },
});

export const Route = createFileRoute("/_authenticated/portal/admin")({
  head: () => ({ meta: [
    { title: "Administração — Portal Sr. Strix" },
    { name: "description", content: "Gerencie pessoas e sistemas do portal Sr. Strix." },
    { property: "og:title", content: "Administração — Portal Sr. Strix" },
    { property: "og:description", content: "Gerencie pessoas e sistemas do portal Sr. Strix." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  loader: async ({ context }) => {
    const p = await context.queryClient.ensureQueryData(portalQuery);
    if (!p.isAdmin) throw redirect({ to: "/portal" });
    await Promise.all([context.queryClient.ensureQueryData(usersQuery), context.queryClient.ensureQueryData(systemsQuery)]);
  },
  component: Admin,
});

type User = Database["public"]["Functions"]["admin_list_users"]["Returns"][number];
type System = Database["public"]["Tables"]["portal_systems"]["Row"];

const fmt = (d: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(new Date(d));
const input = "w-full rounded-lg border border-portal-line bg-portal-bg px-3 py-2 text-sm text-portal-fg placeholder:text-portal-muted focus:border-portal-accent focus:outline-none";
const primary = "inline-flex items-center gap-2 rounded-full bg-portal-accent px-4 py-2 text-sm font-medium text-portal-fg transition hover:opacity-90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-accent focus-visible:ring-offset-2 focus-visible:ring-offset-portal-bg";
const ghost = "inline-flex h-8 w-8 items-center justify-center rounded-full text-portal-muted transition hover:bg-portal-card hover:text-portal-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-accent";
const dlg = "border-portal-line bg-portal-bg text-portal-fg sm:max-w-lg";

function Admin() {
  const { data: portal } = useSuspenseQuery(portalQuery);
  const [tab, setTab] = useState<"users" | "systems">("users");
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const ctx = gsap.context(() => { gsap.from(".a-reveal", { y: 20, opacity: 0, duration: 0.7, stagger: 0.05, ease: "power3.out" }); }, root);
      return () => ctx.revert();
    });
    return () => mm.revert();
  }, []);

  return (
    <div ref={root} className="relative min-h-screen overflow-hidden bg-portal-bg text-portal-fg">
      <ParticleField className="pointer-events-none fixed inset-0 opacity-40" />
      <PortalHeader email={portal.email} isAdmin />
      <main className="relative z-10 mx-auto w-full max-w-6xl px-5 pb-20 pt-8 sm:px-8 sm:pt-14">
        <p className="a-reveal text-xs uppercase tracking-[0.3em] text-portal-accent">Administração</p>
        <h1 className="a-reveal mt-3 text-3xl font-light tracking-tight sm:text-4xl">Gestão do portal</h1>
        <div role="tablist" aria-label="Seções" className="a-reveal mt-8 inline-flex rounded-full border border-portal-line bg-portal-card p-1">
          {([["users", "Pessoas"], ["systems", "Sistemas"]] as const).map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
              className={`rounded-full px-5 py-1.5 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-accent ${tab === k ? "bg-portal-accent text-portal-fg" : "text-portal-muted hover:text-portal-fg"}`}>{l}</button>
          ))}
        </div>
        <div className="mt-6">{tab === "users" ? <UsersTab /> : <SystemsTab />}</div>
      </main>
    </div>
  );
}

/* ---------------- Pessoas ---------------- */

function UsersTab() {
  const { data: users } = useSuspenseQuery(usersQuery);
  const { data: systems } = useSuspenseQuery(systemsQuery);
  const { data: portal } = useSuspenseQuery(portalQuery);
  const qc = useQueryClient();
  const del = useServerFn(adminDeleteUser);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<User | "new" | null>(null);
  const [removing, setRemoving] = useState<User | null>(null);
  const [busy, setBusy] = useState(false);
  const me = users.find((u) => u.email === portal.email)?.id;

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return users.filter((u) => !t || (u.email ?? "").toLowerCase().includes(t) || (u.display_name ?? "").toLowerCase().includes(t));
  }, [users, q]);

  async function confirmDelete() {
    if (!removing || busy) return;
    setBusy(true);
    try {
      await del({ data: { id: removing.id } });
      toast.success("Pessoa excluída.");
      setRemoving(null);
      await qc.invalidateQueries({ queryKey: usersQuery.queryKey });
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex w-full max-w-sm items-center gap-2 rounded-full border border-portal-line bg-portal-card px-4 py-2 focus-within:border-portal-accent">
          <Search className="h-4 w-4 text-portal-muted" aria-hidden />
          <span className="sr-only">Buscar pessoa</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome ou e-mail" className="w-full bg-transparent text-sm placeholder:text-portal-muted focus:outline-none" />
        </label>
        <button className={primary} onClick={() => setEditing("new")}><Plus className="h-4 w-4" aria-hidden /> Nova pessoa</button>
      </div>
      <div className="mt-4 overflow-hidden rounded-2xl border border-portal-line bg-portal-card backdrop-blur-md">
        <ul>
          {list.map((u) => {
            const names = u.is_admin ? ["Todos (admin)"] : systems.filter((s) => (u.system_ids ?? []).includes(s.id)).map((s) => s.name);
            return (
              <li key={u.id} className="flex items-center gap-3 border-b border-portal-line px-5 py-4 last:border-0">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-portal-accent/15 text-sm font-medium text-portal-accent">{(u.display_name || u.email || "?").slice(0, 1).toUpperCase()}</div>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 truncate text-sm font-medium">
                    {u.display_name || u.email}
                    {u.is_admin && <span className="inline-flex items-center gap-1 rounded-full bg-portal-accent/15 px-2 py-0.5 text-[10px] text-portal-accent"><ShieldCheck className="h-3 w-3" aria-hidden />Admin</span>}
                  </p>
                  <p className="truncate text-xs text-portal-muted">{u.email} · desde {fmt(u.created_at)}</p>
                </div>
                <p className="hidden max-w-[220px] truncate text-xs text-portal-muted md:block">{names.length ? names.join(", ") : "Sem acesso"}</p>
                <button className={ghost} aria-label={`Editar ${u.email}`} onClick={() => setEditing(u)}><Pencil className="h-4 w-4" /></button>
                <button className={ghost} aria-label={`Excluir ${u.email}`} disabled={u.id === me} onClick={() => setRemoving(u)}><Trash2 className="h-4 w-4" /></button>
              </li>
            );
          })}
          {list.length === 0 && <li className="px-5 py-10 text-center text-sm text-portal-muted">Ninguém encontrado.</li>}
        </ul>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className={dlg}>
          {editing && <UserForm user={editing === "new" ? null : editing} systems={systems} isSelf={editing !== "new" && editing.id === me} onDone={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)}>
        <AlertDialogContent className={dlg}>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {removing?.display_name || removing?.email}?</AlertDialogTitle>
            <AlertDialogDescription className="text-portal-muted">A pessoa perde o acesso ao portal imediatamente. Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={(e) => { e.preventDefault(); void confirmDelete(); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{busy ? "Excluindo..." : "Excluir"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function UserForm({ user, systems, isSelf, onDone }: { user: User | null; systems: System[]; isSelf: boolean; onDone: () => void }) {
  const qc = useQueryClient();
  const create = useServerFn(adminCreateUser);
  const update = useServerFn(adminUpdateUser);
  const [name, setName] = useState(user?.display_name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [password, setPassword] = useState("");
  const [isAdmin, setIsAdmin] = useState(user?.is_admin ?? false);
  const [ids, setIds] = useState<string[]>(user?.system_ids ?? []);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const er: Record<string, string> = {};
    if (!name.trim()) er.name = "Informe o nome.";
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) er.email = "Informe um e-mail válido.";
    if (!user && password.length < 6) er.password = "A senha precisa ter pelo menos 6 caracteres.";
    if (user && password && password.length < 6) er.password = "A senha precisa ter pelo menos 6 caracteres.";
    setErrors(er);
    if (Object.keys(er).length) return;
    setBusy(true);
    try {
      const payload = { name: name.trim(), email: email.trim(), isAdmin, systemIds: ids };
      if (user) await update({ data: { ...payload, id: user.id, password: password || undefined } });
      else await create({ data: { ...payload, password } });
      toast.success(user ? "Pessoa atualizada." : "Pessoa criada. Ela já pode entrar com o e-mail e a senha definidos.");
      await qc.invalidateQueries({ queryKey: usersQuery.queryKey });
      if (isSelf) await qc.invalidateQueries({ queryKey: portalQuery.queryKey });
      onDone();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  const err = (k: string) => errors[k] && <p id={`${k}-err`} className="mt-1 text-xs text-destructive">{errors[k]}</p>;
  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <DialogHeader>
        <DialogTitle>{user ? "Editar pessoa" : "Nova pessoa"}</DialogTitle>
        <DialogDescription className="text-portal-muted">{user ? "Altere os dados e os sistemas liberados." : "Defina o acesso inicial. Você informa a senha para a pessoa."}</DialogDescription>
      </DialogHeader>
      <div><label htmlFor="u-name" className="text-xs text-portal-muted">Nome</label><input id="u-name" className={input} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} aria-invalid={!!errors.name} />{err("name")}</div>
      <div><label htmlFor="u-email" className="text-xs text-portal-muted">E-mail</label><input id="u-email" type="email" className={input} value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!errors.email} />{err("email")}</div>
      <div><label htmlFor="u-pw" className="text-xs text-portal-muted">{user ? "Nova senha (deixe em branco para manter)" : "Senha"}</label><input id="u-pw" type="text" autoComplete="new-password" className={input} value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={!!errors.password} />{err("password")}</div>
      <label className="flex items-center justify-between gap-3 rounded-lg border border-portal-line px-3 py-2.5">
        <span><span className="block text-sm">Administrador</span><span className="text-xs text-portal-muted">Acessa todos os sistemas e esta gestão.</span></span>
        <Switch checked={isAdmin} disabled={isSelf} onCheckedChange={setIsAdmin} aria-label="Administrador" />
      </label>
      <fieldset disabled={isAdmin} className="space-y-2 disabled:opacity-50">
        <legend className="mb-1 text-xs text-portal-muted">Sistemas liberados</legend>
        {systems.map((s) => (
          <label key={s.id} className="flex items-center justify-between gap-3 rounded-lg border border-portal-line px-3 py-2.5">
            <span className="text-sm">{s.name}{!s.active && <span className="ml-2 text-xs text-portal-muted">(desativado)</span>}</span>
            <Switch checked={isAdmin || ids.includes(s.id)} onCheckedChange={(v) => setIds((p) => v ? [...p, s.id] : p.filter((x) => x !== s.id))} aria-label={s.name} />
          </label>
        ))}
      </fieldset>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onDone} className="rounded-full px-4 py-2 text-sm text-portal-muted hover:text-portal-fg">Cancelar</button>
        <button type="submit" className={primary} disabled={busy}>{busy ? "Salvando..." : "Salvar"}</button>
      </div>
    </form>
  );
}

/* ---------------- Sistemas ---------------- */

function SystemsTab() {
  const { data: systems } = useSuspenseQuery(systemsQuery);
  const qc = useQueryClient();
  const [editing, setEditing] = useState<System | "new" | null>(null);
  const [removing, setRemoving] = useState<System | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: systemsQuery.queryKey }), qc.invalidateQueries({ queryKey: portalQuery.queryKey })]);

  async function toggle(s: System, active: boolean) {
    if (busy) return;
    setBusy(s.id);
    const { error } = await supabase.from("portal_systems").update({ active }).eq("id", s.id);
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success(active ? "Sistema habilitado no portal." : "Sistema desabilitado no portal.");
    await refresh();
  }
  async function confirmDelete() {
    if (!removing) return;
    const { error } = await supabase.from("portal_systems").delete().eq("id", removing.id);
    if (error) return toast.error(error.message);
    toast.success("Sistema excluído.");
    setRemoving(null);
    await Promise.all([refresh(), qc.invalidateQueries({ queryKey: usersQuery.queryKey })]);
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-portal-muted">Sistemas desabilitados somem do portal para todos.</p>
        <button className={primary} onClick={() => setEditing("new")}><Plus className="h-4 w-4" aria-hidden /> Novo sistema</button>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {systems.map((s) => (
          <div key={s.id} className="rounded-2xl border border-portal-line bg-portal-card p-5 backdrop-blur-md">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="truncate font-semibold">{s.name}</h3>
                <p className="truncate text-xs text-portal-muted">{s.path}</p>
              </div>
              <Switch checked={s.active} disabled={busy === s.id} onCheckedChange={(v) => toggle(s, v)} aria-label={`Habilitar ${s.name}`} />
            </div>
            <p className="mt-3 line-clamp-2 text-sm text-portal-muted">{s.description || "Sem descrição."}</p>
            <div className="mt-4 flex items-center justify-between">
              <span className={`text-xs ${s.active ? "text-success" : "text-portal-muted"}`}>{s.active ? "● Habilitado" : "○ Desabilitado"}</span>
              <div className="flex">
                <button className={ghost} aria-label={`Editar ${s.name}`} onClick={() => setEditing(s)}><Pencil className="h-4 w-4" /></button>
                <button className={ghost} aria-label={`Excluir ${s.name}`} onClick={() => setRemoving(s)}><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          </div>
        ))}
        {systems.length === 0 && <p className="text-sm text-portal-muted">Nenhum sistema cadastrado.</p>}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className={dlg}>
          {editing && <SystemForm system={editing === "new" ? null : editing} nextOrder={systems.length + 1} onDone={async () => { setEditing(null); await refresh(); }} />}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)}>
        <AlertDialogContent className={dlg}>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {removing?.name}?</AlertDialogTitle>
            <AlertDialogDescription className="text-portal-muted">O card sai do portal e todos os acessos liberados para ele são removidos. Para só esconder, prefira desabilitar.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); void confirmDelete(); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function SystemForm({ system, nextOrder, onDone }: { system: System | null; nextOrder: number; onDone: () => void }) {
  const [name, setName] = useState(system?.name ?? "");
  const [slug, setSlug] = useState(system?.slug ?? "");
  const [description, setDescription] = useState(system?.description ?? "");
  const [path, setPath] = useState(system?.path ?? "/");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const er: Record<string, string> = {};
    if (!name.trim()) er.name = "Informe o nome.";
    if (!/^[a-z0-9-]{2,40}$/.test(slug)) er.slug = "Use letras minúsculas, números e hífen.";
    if (!/^\/[\w\-/]*$/.test(path.trim())) er.path = "O endereço deve começar com /.";
    setErrors(er);
    if (Object.keys(er).length) return;
    setBusy(true);
    const row = { name: name.trim(), slug, description: description.trim(), path: path.trim() };
    const { error } = system
      ? await supabase.from("portal_systems").update(row).eq("id", system.id)
      : await supabase.from("portal_systems").insert({ ...row, sort_order: nextOrder });
    setBusy(false);
    if (error) return toast.error(error.code === "23505" ? "Já existe um sistema com esse identificador." : error.message);
    toast.success(system ? "Sistema atualizado." : "Sistema criado.");
    onDone();
  }
  const err = (k: string) => errors[k] && <p className="mt-1 text-xs text-destructive">{errors[k]}</p>;
  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <DialogHeader>
        <DialogTitle>{system ? "Editar sistema" : "Novo sistema"}</DialogTitle>
        <DialogDescription className="text-portal-muted">Dados exibidos no card do portal.</DialogDescription>
      </DialogHeader>
      <div><label htmlFor="s-name" className="text-xs text-portal-muted">Nome</label><input id="s-name" className={input} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />{err("name")}</div>
      <div><label htmlFor="s-slug" className="text-xs text-portal-muted">Identificador</label><input id="s-slug" className={input} value={slug} disabled={system?.slug === "financas"} onChange={(e) => setSlug(e.target.value.toLowerCase())} placeholder="ex.: crm" />{err("slug")}</div>
      <div><label htmlFor="s-desc" className="text-xs text-portal-muted">Descrição</label><textarea id="s-desc" rows={3} className={input} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} /></div>
      <div><label htmlFor="s-path" className="text-xs text-portal-muted">Endereço de entrada</label><input id="s-path" className={input} value={path} onChange={(e) => setPath(e.target.value)} placeholder="/dashboard" />{err("path")}</div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onDone} className="rounded-full px-4 py-2 text-sm text-portal-muted hover:text-portal-fg">Cancelar</button>
        <button type="submit" className={primary} disabled={busy}>{busy ? "Salvando..." : "Salvar"}</button>
      </div>
    </form>
  );
}
