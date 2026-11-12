import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Confirm, EmptyState, Field, FormModal, Money, MoneyInput, NativeSelect, PageHeader, Panel, ProgressBar, Tag, centsToInput } from "@/components/app/kit";
import { MonthPicker, WithData } from "@/components/app/WithData";
import { CategoryIcon } from "@/components/app/icons";
import { errMsg, useRefresh, type Budget, type FinanceData } from "@/lib/data";
import { addMonths, budgetLevel, monthEnd, monthLabel, monthStart, parseBRL, pct, todayBR } from "@/lib/finance";
import { competenceExpenses, sumByCategory } from "@/lib/selectors";

const search = z.object({ month: fallback(z.string(), "").default("") });

export const Route = createFileRoute("/_authenticated/orcamentos")({
  validateSearch: zodValidator(search),
  head: () => ({ meta: [{ title: "Orçamentos — W2A Finanças" }, { name: "description", content: "Limites mensais por categoria." }] }),
  component: () => <WithData>{(d) => <Orcamentos d={d} />}</WithData>,
});

function Orcamentos({ d }: { d: FinanceData }) {
  const s = Route.useSearch();
  const navigate = useNavigate({ from: "/orcamentos" });
  const refresh = useRefresh();
  const month = /^\d{4}-\d{2}-01$/.test(s.month) ? s.month : monthStart(todayBR());
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Budget | null>(null);
  const cat = new Map(d.categories.map((c) => [c.id, c]));
  const used = new Map(sumByCategory(competenceExpenses(d, month, monthEnd(month))).map((x) => [x.category_id, x.amount]));
  const list = d.budgets.filter((b) => b.month === month);
  const totalLimit = list.reduce((a, b) => a + b.limit_cents, 0);
  const totalUsed = list.reduce((a, b) => a + (used.get(b.category_id) ?? 0), 0);

  async function copyPrev() {
    const prev = d.budgets.filter((b) => b.month === addMonths(month, -1));
    const rows = prev.filter((p) => !list.some((b) => b.category_id === p.category_id)).map((p) => ({ user_id: p.user_id, category_id: p.category_id, month, limit_cents: p.limit_cents }));
    if (!rows.length) return toast.info("Nada para copiar do mês anterior.");
    const { error } = await supabase.from("budgets").insert(rows);
    if (error) return toast.error(errMsg(error));
    toast.success(`${rows.length} orçamento(s) copiado(s).`); refresh();
  }

  return (
    <div>
      <PageHeader title="Orçamentos" description={`Despesas por competência em ${monthLabel(month)}, pendentes ou realizadas, incluindo parcelas de cartão.`}
        actions={<>
          <MonthPicker value={month} onChange={(v) => navigate({ search: { month: v } })} />
          <Button variant="outline" onClick={copyPrev}><Copy className="h-4 w-4" /> Copiar mês anterior</Button>
          <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="h-4 w-4" /> Novo orçamento</Button>
        </>} />
      {list.length > 0 && (
        <Panel className="mb-4">
          <div className="flex flex-wrap justify-between gap-2 text-sm"><span>Total comprometido <Money cents={totalUsed} className="font-semibold" /> de <Money cents={totalLimit} /></span><span>{(pct(totalUsed, totalLimit) ?? 0).toFixed(0)}%</span></div>
          <div className="mt-2"><ProgressBar value={pct(totalUsed, totalLimit) ?? 0} label="Orçamento total" tone={budgetLevel(totalUsed, totalLimit) === "over" ? "danger" : budgetLevel(totalUsed, totalLimit) === "warn" ? "warning" : "primary"} /></div>
        </Panel>
      )}
      {list.length === 0 ? (
        <Panel><EmptyState title="Nenhum orçamento neste mês" description="Defina limites mensais para suas categorias de despesa." action={<Button onClick={() => { setEditing(null); setOpen(true); }}>Criar orçamento</Button>} /></Panel>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((b) => {
            const c = cat.get(b.category_id);
            const u = used.get(b.category_id) ?? 0;
            const p = pct(u, b.limit_cents) ?? 0;
            const lvl = budgetLevel(u, b.limit_cents);
            return (
              <Panel key={b.id}>
                <div className="flex items-center gap-2">
                  {c && <CategoryIcon icon={c.icon} color={c.color} />}
                  <p className="flex-1 font-semibold">{c?.name}</p>
                  {lvl === "over" && <Tag tone="danger" icon={<AlertTriangle className="h-3 w-3" />}>Ultrapassado</Tag>}
                  {lvl === "warn" && <Tag tone="warning" icon={<AlertTriangle className="h-3 w-3" />}>80% atingido</Tag>}
                </div>
                <div className="mt-3"><ProgressBar value={p} tone={lvl === "over" ? "danger" : lvl === "warn" ? "warning" : "primary"} label={c?.name ?? ""} /></div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div><dt className="text-muted-foreground">Comprometido</dt><dd><Money cents={u} /></dd></div>
                  <div><dt className="text-muted-foreground">Limite</dt><dd><Money cents={b.limit_cents} /></dd></div>
                  <div><dt className="text-muted-foreground">Restante</dt><dd><Money cents={b.limit_cents - u} tone={b.limit_cents - u < 0 ? "expense" : undefined} /></dd></div>
                  <div><dt className="text-muted-foreground">Utilizado</dt><dd className="tabular">{p.toFixed(0)}%</dd></div>
                </dl>
                <div className="mt-2 flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => { setEditing(b); setOpen(true); }}><Pencil className="h-4 w-4" /> Editar</Button>
                  <Confirm title="Excluir orçamento?" onConfirm={async () => { const { error } = await supabase.from("budgets").delete().eq("id", b.id); if (error) toast.error(errMsg(error)); else { toast.success("Orçamento excluído."); refresh(); } }}
                    trigger={<Button size="sm" variant="ghost" className="text-destructive"><Trash2 className="h-4 w-4" /> Excluir</Button>} />
                </div>
              </Panel>
            );
          })}
        </div>
      )}
      <BudgetForm open={open} onOpenChange={setOpen} budget={editing} month={month} d={d} />
    </div>
  );
}

function BudgetForm({ open, onOpenChange, budget, month, d }: { open: boolean; onOpenChange: (o: boolean) => void; budget: Budget | null; month: string; d: FinanceData }) {
  const refresh = useRefresh();
  const taken = new Set(d.budgets.filter((b) => b.month === month && b.id !== budget?.id).map((b) => b.category_id));
  const cats = d.categories.filter((c) => c.kind === "expense" && (!c.archived || c.id === budget?.category_id) && !taken.has(c.id));
  const [category, setCategory] = useState(""); const [limit, setLimit] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setErrors({}); setCategory(budget?.category_id ?? cats[0]?.id ?? ""); setLimit(budget ? centsToInput(budget.limit_cents) : ""); } }, [open, budget]); // eslint-disable-line react-hooks/exhaustive-deps
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const er: Record<string, string> = {}; const c = parseBRL(limit);
    if (!category) er.category = "Selecione a categoria.";
    if (!c || c <= 0) er.limit = "Informe um limite positivo.";
    setErrors(er);
    if (Object.keys(er).length || busy) return;
    setBusy(true);
    const { error } = budget ? await supabase.from("budgets").update({ category_id: category, limit_cents: c! }).eq("id", budget.id)
      : await supabase.from("budgets").insert({ user_id: d.profile!.id, category_id: category, month, limit_cents: c! });
    setBusy(false);
    if (error) return toast.error(errMsg(error));
    toast.success("Orçamento salvo."); refresh(); onOpenChange(false);
  }
  return (
    <FormModal open={open} onOpenChange={onOpenChange} title={budget ? "Editar orçamento" : "Novo orçamento"} description={monthLabel(month)}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Categoria de despesa" htmlFor="bg-cat" error={errors.category}><NativeSelect id="bg-cat" value={category} onChange={(e) => setCategory(e.target.value)}>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</NativeSelect></Field>
        <Field label="Limite mensal" htmlFor="bg-limit" error={errors.limit}><MoneyInput id="bg-limit" value={limit} onChange={setLimit} /></Field>
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit" disabled={busy}>Salvar</Button></div>
      </form>
    </FormModal>
  );
}
