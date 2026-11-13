import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Archive, ArchiveRestore, Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, Field, FormModal, NativeSelect, PageHeader, Panel, Tag } from "@/components/app/kit";
import { WithData } from "@/components/app/WithData";
import { CATEGORY_ICONS, COLOR_CHOICES, CategoryIcon, ColorPicker } from "@/components/app/icons";
import { errMsg, useRefresh, type Category, type FinanceData } from "@/lib/data";

const search = z.object({ tipo: fallback(z.string(), "expense").default("expense"), q: fallback(z.string(), "").default("") });

export const Route = createFileRoute("/_authenticated/finance/categories")({
  validateSearch: zodValidator(search),
  head: () => ({ meta: [{ title: "Categorias — Sr. Strix Finanças" }, { name: "description", content: "Categorias de receitas e despesas." }, { property: "og:title", content: "Categorias — Sr. Strix Finanças" }, { property: "og:description", content: "Categorias de receitas e despesas." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: () => <WithData>{(d) => <Categorias d={d} />}</WithData>,
});

function usage(d: FinanceData, id: string) {
  return d.transactions.filter((t) => t.category_id === id).length + d.purchases.filter((p) => p.category_id === id).length + d.recurrences.filter((r) => r.category_id === id).length;
}

function Categorias({ d }: { d: FinanceData }) {
  const s = Route.useSearch();
  const navigate = useNavigate({ from: "/finance/categories" });
  const refresh = useRefresh();
  const kind = s.tipo === "income" ? "income" : "expense";
  const [editing, setEditing] = useState<Category | null>(null);
  const [open, setOpen] = useState(false);
  const [removing, setRemoving] = useState<Category | null>(null);
  const q = s.q.toLowerCase();
  const list = d.categories.filter((c) => c.kind === kind && (!q || c.name.toLowerCase().includes(q))).sort((a, b) => Number(a.archived) - Number(b.archived) || a.name.localeCompare(b.name));

  async function act(p: PromiseLike<{ error: unknown }>, msg: string) {
    const { error } = await p;
    if (error) return toast.error(errMsg(error));
    toast.success(msg); refresh();
  }

  return (
    <div>
      <PageHeader title="Categorias" description="Organize receitas e despesas." actions={<Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="h-4 w-4" /> Nova categoria</Button>} />
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="inline-flex rounded-lg border bg-card p-1" role="tablist">
          {(["expense", "income"] as const).map((k) => (
            <button key={k} role="tab" aria-selected={kind === k} onClick={() => navigate({ search: (p) => ({ ...p, tipo: k }) })}
              className={`rounded-md px-3 py-1.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${kind === k ? "bg-primary text-primary-foreground" : ""}`}>{k === "expense" ? "Despesas" : "Receitas"}</button>
          ))}
        </div>
        <Input aria-label="Buscar categoria" placeholder="Buscar..." value={s.q} onChange={(e) => navigate({ search: (p) => ({ ...p, q: e.target.value }) })} className="max-w-xs" />
      </div>
      <Panel>
        {list.length === 0 ? <EmptyState title="Nenhuma categoria" /> : (
          <ul className="divide-y">
            {list.map((c) => {
              const used = usage(d, c.id);
              return (
                <li key={c.id} className="flex items-center gap-3 py-2">
                  <CategoryIcon icon={c.icon} color={c.color} />
                  <div className="min-w-0 flex-1"><p className={`font-medium ${c.archived ? "text-muted-foreground" : ""}`}>{c.name}</p><p className="text-xs text-muted-foreground">{used} uso(s)</p></div>
                  {c.archived && <Tag>Arquivada</Tag>}
                  <Button size="icon" variant="ghost" aria-label={`Editar ${c.name}`} onClick={() => { setEditing(c); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" aria-label={c.archived ? `Reativar ${c.name}` : `Arquivar ${c.name}`} onClick={() => act(supabase.from("categories").update({ archived: !c.archived }).eq("id", c.id), c.archived ? "Categoria reativada." : "Categoria arquivada.")}>
                    {c.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                  </Button>
                  <Button size="icon" variant="ghost" className="text-destructive" aria-label={`Excluir ${c.name}`} onClick={() => setRemoving(c)}><Trash2 className="h-4 w-4" /></Button>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
      <CategoryForm open={open} onOpenChange={setOpen} cat={editing} kind={kind} userId={d.profile?.id ?? ""} />
      {removing && <DeleteCategory cat={removing} d={d} onClose={() => setRemoving(null)} />}
    </div>
  );
}

function CategoryForm({ open, onOpenChange, cat, kind, userId }: { open: boolean; onOpenChange: (o: boolean) => void; cat: Category | null; kind: string; userId: string }) {
  const refresh = useRefresh();
  const [name, setName] = useState(""); const [k, setK] = useState(kind); const [icon, setIcon] = useState("tag"); const [color, setColor] = useState(COLOR_CHOICES[0]);
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setErr(""); setName(cat?.name ?? ""); setK(cat?.kind ?? kind); setIcon(cat?.icon ?? "tag"); setColor(cat?.color ?? COLOR_CHOICES[0]); } }, [open, cat, kind]);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setErr("Informe o nome.");
    setBusy(true);
    const row = { name: name.trim(), icon, color };
    const { error } = cat ? await supabase.from("categories").update(row).eq("id", cat.id) : await supabase.from("categories").insert({ ...row, kind: k, user_id: userId });
    setBusy(false);
    if (error) return toast.error(errMsg(error));
    toast.success(cat ? "Categoria atualizada." : "Categoria criada."); refresh(); onOpenChange(false);
  }
  return (
    <FormModal open={open} onOpenChange={onOpenChange} title={cat ? "Editar categoria" : "Nova categoria"}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Nome" htmlFor="cat-name" error={err}><Input id="cat-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} /></Field>
        {!cat && <Field label="Tipo" htmlFor="cat-kind"><NativeSelect id="cat-kind" value={k} onChange={(e) => setK(e.target.value)}><option value="expense">Despesa</option><option value="income">Receita</option></NativeSelect></Field>}
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">Ícone</legend>
          <div className="flex flex-wrap gap-2">
            {Object.entries(CATEGORY_ICONS).map(([key, I]) => (
              <button key={key} type="button" aria-label={`Ícone ${key}`} aria-pressed={icon === key} onClick={() => setIcon(key)}
                className={`flex h-9 w-9 items-center justify-center rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${icon === key ? "border-primary bg-accent" : ""}`}><I className="h-4 w-4" /></button>
            ))}
          </div>
        </fieldset>
        <ColorPicker value={color} onChange={setColor} />
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit" disabled={busy}>Salvar</Button></div>
      </form>
    </FormModal>
  );
}

function DeleteCategory({ cat, d, onClose }: { cat: Category; d: FinanceData; onClose: () => void }) {
  const refresh = useRefresh();
  const used = usage(d, cat.id);
  const targets = d.categories.filter((c) => c.kind === cat.kind && c.id !== cat.id && !c.archived);
  const [target, setTarget] = useState(targets[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  async function confirm() {
    setBusy(true);
    try {
      if (used > 0) {
        if (!target) throw new Error("Selecione a categoria de destino.");
        for (const table of ["transactions", "card_purchases", "recurrences"] as const) {
          const { error } = await supabase.from(table).update({ category_id: target }).eq("category_id", cat.id);
          if (error) throw error;
        }
      }
      const { error } = await supabase.from("categories").delete().eq("id", cat.id);
      if (error) throw error;
      toast.success("Categoria excluída."); refresh(); onClose();
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  }
  return (
    <FormModal open onOpenChange={(o) => !o && onClose()} title={`Excluir ${cat.name}?`} description={used > 0 ? `Esta categoria tem ${used} uso(s). Reclassifique os registros antes de excluir, ou arquive-a.` : "A categoria será removida definitivamente."}>
      <div className="space-y-4">
        {used > 0 && (
          <Field label="Mover registros para" htmlFor="cat-target">
            <NativeSelect id="cat-target" value={target} onChange={(e) => setTarget(e.target.value)}>{targets.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</NativeSelect>
          </Field>
        )}
        <div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Cancelar</Button><Button variant="destructive" disabled={busy || (used > 0 && !target)} onClick={confirm}>{used > 0 ? "Reclassificar e excluir" : "Excluir"}</Button></div>
      </div>
    </FormModal>
  );
}
