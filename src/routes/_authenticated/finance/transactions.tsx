import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useMemo } from "react";
import { toast } from "sonner";
import { Ban, Check, CreditCard, MoreHorizontal, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useState } from "react";
import { EmptyState, Money, NativeSelect, PageHeader, Pager, Panel, Tag } from "@/components/app/kit";
import { WithData } from "@/components/app/WithData";
import { CategoryIcon } from "@/components/app/icons";
import { useTxDialog } from "@/components/app/AppShell";
import { errMsg, PAYMENT_METHODS, useRefresh, type FinanceData, type Tx } from "@/lib/data";
import { formatDate, monthEnd, monthStart, todayBR, txDisplayStatus } from "@/lib/finance";

const search = z.object({
  q: fallback(z.string(), "").default(""),
  from: fallback(z.string(), "").default(""),
  to: fallback(z.string(), "").default(""),
  kind: fallback(z.string(), "").default(""),
  category: fallback(z.string(), "").default(""),
  account: fallback(z.string(), "").default(""),
  card: fallback(z.string(), "").default(""),
  status: fallback(z.string(), "").default(""),
  sort: fallback(z.string(), "date_desc").default("date_desc"),
  page: fallback(z.number().int(), 1).default(1),
});

export const Route = createFileRoute("/_authenticated/finance/transactions")({
  validateSearch: zodValidator(search),
  head: () => ({ meta: [{ title: "Lançamentos — Sr. Strix Finanças" }, { name: "description", content: "Receitas, despesas e compras no cartão." }, { property: "og:title", content: "Lançamentos — Sr. Strix Finanças" }, { property: "og:description", content: "Receitas, despesas e compras no cartão." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: () => <WithData>{(d) => <Lancamentos d={d} />}</WithData>,
});

interface Row {
  id: string; date: string; description: string; category_id: string; amount: number; kind: "income" | "expense";
  status: string; where: string; method: string; tx?: Tx; label?: string; source: "bank" | "card";
}

const PAGE = 20;

function Lancamentos({ d }: { d: FinanceData }) {
  const s = Route.useSearch();
  const navigate = useNavigate({ from: "/finance/transactions" });
  const { openTx, editTx } = useTxDialog();
  const refresh = useRefresh();
  const today = todayBR();
  const from = s.from || monthStart(today);
  const to = s.to || monthEnd(today);
  const set = (p: Partial<typeof s>) => navigate({ search: (prev) => ({ ...prev, ...p, page: p.page ?? 1 }) });
  const [seriesAction, setSeriesAction] = useState<{ tx: Tx; action: "cancel" | "delete" } | null>(null);

  const cat = new Map(d.categories.map((c) => [c.id, c]));
  const acc = new Map(d.accounts.map((a) => [a.id, a]));
  const cards = new Map(d.cards.map((c) => [c.id, c]));

  const rows = useMemo(() => {
    const out: Row[] = [];
    if (!s.card) for (const t of d.transactions) {
      out.push({ id: t.id, date: t.due_date, description: t.description, category_id: t.category_id, amount: t.amount_cents, kind: t.kind as "income",
        status: txDisplayStatus(t, today), where: acc.get(t.account_id)?.name ?? "—", method: PAYMENT_METHODS[t.payment_method] ?? t.payment_method, tx: t, source: "bank" });
    }
    if (!s.account && s.kind !== "income") {
      const inv = new Map(d.invoices.map((i) => [i.id, i]));
      const pur = new Map(d.purchases.map((p) => [p.id, p]));
      for (const i of d.installments) {
        const p = pur.get(i.purchase_id); const iv = inv.get(i.invoice_id);
        if (!p || !iv || (s.card && p.card_id !== s.card)) continue;
        out.push({ id: i.id, date: iv.due_date, description: p.description, category_id: p.category_id, amount: Math.abs(i.amount_cents), kind: i.amount_cents < 0 ? "income" : "expense",
          status: "card", where: cards.get(p.card_id)?.name ?? "Cartão", method: i.amount_cents < 0 ? "Estorno" : "Crédito", label: `${i.number}/${i.total_count}`, source: "card" });
      }
    }
    const q = s.q.trim().toLowerCase();
    const f = out.filter((r) =>
      r.date >= from && r.date <= to &&
      (!s.kind || r.kind === s.kind) &&
      (!s.category || r.category_id === s.category) &&
      (!s.account || r.tx?.account_id === s.account) &&
      (!s.status || r.status === s.status || (s.status === "pending" && r.status === "overdue")) &&
      (!q || r.description.toLowerCase().includes(q)));
    const [k, dir] = s.sort.split("_");
    f.sort((a, b) => {
      const v = k === "amount" ? a.amount - b.amount : k === "desc" ? a.description.localeCompare(b.description) : a.date.localeCompare(b.date);
      return dir === "asc" ? v : -v;
    });
    return f;
  }, [d, s, from, to, today]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const page = Math.min(s.page, pages);
  const visible = rows.slice((page - 1) * PAGE, page * PAGE);
  const totalIn = rows.filter((r) => r.kind === "income" && r.status !== "cancelled").reduce((a, r) => a + r.amount, 0);
  const totalOut = rows.filter((r) => r.kind === "expense" && r.status !== "cancelled").reduce((a, r) => a + r.amount, 0);

  async function run(p: PromiseLike<{ error: unknown }>, msg: string) {
    const { error } = await p;
    if (error) return toast.error(errMsg(error));
    toast.success(msg);
    refresh();
  }
  const settle = (t: Tx) => {
    const a = acc.get(t.account_id);
    const date = a && today < a.opening_date ? a.opening_date : today;
    return run(supabase.from("transactions").update({ status: "paid", paid_date: date }).eq("id", t.id).eq("status", "pending"), t.kind === "income" ? "Recebimento registrado." : "Pagamento registrado.");
  };
  const undo = (t: Tx) => run(supabase.from("transactions").update({ status: "pending", paid_date: null }).eq("id", t.id), "Baixa desfeita.");

  async function seriesApply(scope: "one" | "following") {
    if (!seriesAction) return;
    const { tx, action } = seriesAction;
    setSeriesAction(null);
    if (scope === "one" || !tx.recurrence_id) {
      // Recurring occurrences are cancelled (not deleted) so regeneration does not recreate them.
      if (action === "delete" && !tx.recurrence_id) return run(supabase.from("transactions").delete().eq("id", tx.id), "Lançamento excluído.");
      return run(supabase.from("transactions").update({ status: "cancelled", paid_date: null }).eq("id", tx.id), "Lançamento cancelado.");
    }
    const { error } = await supabase.from("recurrences").update({ active: false }).eq("id", tx.recurrence_id);
    if (error) return toast.error(errMsg(error));
    return run(
      supabase.from("transactions").update({ status: "cancelled", paid_date: null }).eq("recurrence_id", tx.recurrence_id).gte("recurrence_seq", tx.recurrence_seq ?? 0).eq("status", "pending"),
      "Ocorrências futuras canceladas; as realizadas foram preservadas.",
    );
  }

  const statusTag = (st: string, kind: string) => {
    if (st === "paid") return <Tag tone="success" icon={<Check className="h-3 w-3" />}>{kind === "income" ? "Recebida" : "Paga"}</Tag>;
    if (st === "overdue") return <Tag tone="danger">Atrasada</Tag>;
    if (st === "cancelled") return <Tag tone="neutral" icon={<Ban className="h-3 w-3" />}>Cancelada</Tag>;
    if (st === "card") return <Tag tone="info" icon={<CreditCard className="h-3 w-3" />}>Na fatura</Tag>;
    return <Tag tone="warning">Pendente</Tag>;
  };

  return (
    <div>
      <PageHeader title="Lançamentos" description="Receitas, despesas e parcelas de cartão."
        actions={<>
          <Button variant="outline" onClick={() => openTx({ kind: "income" })}><Plus className="h-4 w-4" /> Receita</Button>
          <Button onClick={() => openTx({ kind: "expense" })}><Plus className="h-4 w-4" /> Despesa</Button>
        </>} />
      <Panel className="mb-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          <Input aria-label="Buscar" placeholder="Buscar descrição..." value={s.q} onChange={(e) => set({ q: e.target.value })} className="sm:col-span-2" />
          <Input aria-label="De" type="date" value={from} onChange={(e) => set({ from: e.target.value })} />
          <Input aria-label="Até" type="date" value={to} onChange={(e) => set({ to: e.target.value })} />
          <NativeSelect aria-label="Tipo" value={s.kind} onChange={(e) => set({ kind: e.target.value })}>
            <option value="">Todos os tipos</option><option value="income">Receitas</option><option value="expense">Despesas</option>
          </NativeSelect>
          <NativeSelect aria-label="Situação" value={s.status} onChange={(e) => set({ status: e.target.value })}>
            <option value="">Todas as situações</option><option value="pending">Pendentes</option><option value="overdue">Atrasadas</option><option value="paid">Realizadas</option><option value="cancelled">Canceladas</option>
          </NativeSelect>
          <NativeSelect aria-label="Categoria" value={s.category} onChange={(e) => set({ category: e.target.value })}>
            <option value="">Todas as categorias</option>
            {d.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </NativeSelect>
          <NativeSelect aria-label="Conta" value={s.account} onChange={(e) => set({ account: e.target.value, card: "" })}>
            <option value="">Todas as contas</option>
            {d.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </NativeSelect>
          <NativeSelect aria-label="Cartão" value={s.card} onChange={(e) => set({ card: e.target.value, account: "" })}>
            <option value="">Todos os cartões</option>
            {d.cards.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </NativeSelect>
          <NativeSelect aria-label="Ordenar" value={s.sort} onChange={(e) => set({ sort: e.target.value })}>
            <option value="date_desc">Data (recentes)</option><option value="date_asc">Data (antigas)</option>
            <option value="amount_desc">Maior valor</option><option value="amount_asc">Menor valor</option><option value="desc_asc">Descrição A–Z</option>
          </NativeSelect>
          <Button variant="ghost" onClick={() => navigate({ search: {} })}>Limpar filtros</Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-sm">
          <span>Entradas: <Money cents={totalIn} tone="income" /></span>
          <span>Saídas: <Money cents={totalOut} tone="expense" /></span>
          <span className="text-muted-foreground">Período por vencimento.</span>
        </div>
      </Panel>
      <Panel>
        {visible.length === 0 ? (
          <EmptyState title="Nenhum lançamento encontrado" description="Ajuste os filtros ou crie um novo lançamento." action={<Button onClick={() => openTx()}>Novo lançamento</Button>} />
        ) : (
          <ul className="divide-y">
            {visible.map((r) => {
              const c = cat.get(r.category_id);
              const t = r.tx;
              return (
                <li key={r.source + r.id} className="flex items-center gap-3 py-3">
                  {c && <CategoryIcon icon={c.icon} color={c.color} />}
                  <div className="min-w-0 flex-1">
                    <p className={`truncate font-medium ${r.status === "cancelled" ? "line-through text-muted-foreground" : ""}`}>
                      {r.description} {r.label && <span className="text-xs text-muted-foreground">({r.label})</span>}
                      {t?.recurrence_id && <span className="ml-1 text-xs text-muted-foreground">↻ mensal</span>}
                    </p>
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <span>{formatDate(r.date)}</span><span>· {c?.name}</span><span>· {r.where}</span><span>· {r.method}</span>{statusTag(r.status, r.kind)}
                    </p>
                  </div>
                  <Money cents={r.kind === "income" ? r.amount : -r.amount} signed tone="auto" className="font-medium" />
                  {t ? (
                    <div className="flex items-center gap-1">
                      {t.status === "pending" && (
                        <Button size="sm" variant="outline" onClick={() => settle(t)} aria-label={t.kind === "income" ? `Receber ${t.description}` : `Pagar ${t.description}`}>
                          <Check className="h-4 w-4" /><span className="hidden md:inline">{t.kind === "income" ? "Receber" : "Pagar"}</span>
                        </Button>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" aria-label={`Ações de ${t.description}`}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => editTx(t)}><Pencil className="h-4 w-4" /> Editar</DropdownMenuItem>
                          {t.status === "paid" && <DropdownMenuItem onClick={() => undo(t)}><RotateCcw className="h-4 w-4" /> Desfazer baixa</DropdownMenuItem>}
                          {t.status === "cancelled" && <DropdownMenuItem onClick={() => undo(t)}><RotateCcw className="h-4 w-4" /> Reativar</DropdownMenuItem>}
                          {t.status !== "cancelled" && <DropdownMenuItem onClick={() => setSeriesAction({ tx: t, action: "cancel" })}><Ban className="h-4 w-4" /> Cancelar</DropdownMenuItem>}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={() => setSeriesAction({ tx: t, action: "delete" })}><Trash2 className="h-4 w-4" /> Excluir</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ) : <span className="w-9" />}
                </li>
              );
            })}
          </ul>
        )}
        <Pager page={page} pages={pages} total={rows.length} setPage={(n) => navigate({ search: (p) => ({ ...p, page: n }) })} />
      </Panel>

      <AlertDialog open={!!seriesAction} onOpenChange={(o) => !o && setSeriesAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{seriesAction?.action === "delete" ? "Excluir lançamento?" : "Cancelar lançamento?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {seriesAction?.tx.recurrence_id
                ? "Este lançamento faz parte de uma recorrência. Ocorrências de séries são canceladas para não serem recriadas; as já realizadas são preservadas."
                : seriesAction?.action === "delete" ? "Esta ação não pode ser desfeita." : "O lançamento deixará de contar nos saldos e relatórios."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            {seriesAction?.tx.recurrence_id ? (
              <>
                <AlertDialogAction onClick={() => seriesApply("one")}>Esta ocorrência</AlertDialogAction>
                <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => seriesApply("following")}>Esta e as próximas</AlertDialogAction>
              </>
            ) : (
              <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => seriesApply("one")}>Confirmar</AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
