import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, Money, NativeSelect, PageHeader, Pager, Panel, ProgressBar, usePaged } from "@/components/app/kit";
import { WithData } from "@/components/app/WithData";
import type { FinanceData } from "@/lib/data";
import { addMonths, formatBRL, formatDate, formatNumberBR, monthEnd, monthLabel, monthStart, monthsBetween, pct, toCSV, todayBR } from "@/lib/finance";
import { cashFlow, competenceExpenses, sumByCategory } from "@/lib/selectors";

const search = z.object({
  view: fallback(z.string(), "caixa").default("caixa"),
  from: fallback(z.string(), "").default(""),
  to: fallback(z.string(), "").default(""),
  account: fallback(z.string(), "").default(""),
  card: fallback(z.string(), "").default(""),
  category: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/_authenticated/finance/reports")({
  validateSearch: zodValidator(search),
  head: () => ({ meta: [{ title: "Relatórios — Sr. Strix Finanças" }, { name: "description", content: "Fluxo de caixa e gastos por competência." }, { property: "og:title", content: "Relatórios — Sr. Strix Finanças" }, { property: "og:description", content: "Fluxo de caixa e gastos por competência." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: () => <WithData>{(d) => <Relatorios d={d} />}</WithData>,
});

interface R { date: string; description: string; category: string; where: string; type: string; amount: number }

function Relatorios({ d }: { d: FinanceData }) {
  const s = Route.useSearch();
  const navigate = useNavigate({ from: "/finance/reports" });
  const set = (p: Partial<typeof s>) => navigate({ search: (prev) => ({ ...prev, ...p }) });
  const today = todayBR();
  const from = s.from || monthStart(addMonths(today, -5));
  const to = s.to || monthEnd(today);
  const isCash = s.view !== "competencia";
  const cat = new Map(d.categories.map((c) => [c.id, c.name]));
  const acc = new Map(d.accounts.map((a) => [a.id, a.name]));
  const cards = new Map(d.cards.map((c) => [c.id, c.name]));

  let rows: R[];
  if (isCash) {
    rows = cashFlow(d, from, to)
      .filter((c) => (!s.account || c.account_id === s.account) && (!s.category || c.category_id === s.category) && (!s.card || c.card_id === s.card))
      .filter((c) => s.account || c.kind !== "transfer")
      .map((c) => ({ date: c.date, description: c.description, category: c.category_id ? cat.get(c.category_id) ?? "" : c.kind === "invoice" ? "Fatura de cartão" : "Transferência",
        where: acc.get(c.account_id) ?? "", type: c.kind === "income" ? "Entrada" : c.kind === "transfer" ? "Transferência" : "Saída", amount: c.amount }));
  } else {
    rows = competenceExpenses(d, from, to)
      .filter((c) => (!s.account || c.account_id === s.account) && (!s.card || c.card_id === s.card) && (!s.category || c.category_id === s.category))
      .map((c) => ({ date: c.date, description: c.description + (c.label ? ` (${c.label})` : ""), category: cat.get(c.category_id) ?? "", where: c.account_id ? acc.get(c.account_id) ?? "" : cards.get(c.card_id ?? "") ?? "",
        type: c.source === "card" ? (c.amount < 0 ? "Estorno cartão" : "Cartão") : "Conta", amount: -c.amount }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }
  const paged = usePaged(rows, 25);
  const inflow = rows.filter((r) => r.amount > 0 && r.type !== "Transferência").reduce((a, r) => a + r.amount, 0);
  const outflow = -rows.filter((r) => r.amount < 0 && r.type !== "Transferência").reduce((a, r) => a + r.amount, 0);

  const nMonths = Math.min(24, Math.max(1, monthsBetween(from, to) + 1));
  const monthly = Array.from({ length: nMonths }, (_, i) => {
    const m = addMonths(from, i);
    const inM = rows.filter((r) => r.date.slice(0, 7) === m.slice(0, 7) && r.type !== "Transferência");
    return { mes: monthLabel(m), Entradas: inM.filter((r) => r.amount > 0).reduce((a, r) => a + r.amount, 0) / 100, Saídas: -inM.filter((r) => r.amount < 0).reduce((a, r) => a + r.amount, 0) / 100 };
  });
  const top = isCash
    ? sumByCategory(cashFlow(d, from, to).filter((c) => c.kind === "expense" && (!s.account || c.account_id === s.account)).map((c) => ({ category_id: c.category_id, amount: -c.amount })))
    : sumByCategory(competenceExpenses(d, from, to).filter((c) => (!s.account || c.account_id === s.account) && (!s.card || c.card_id === s.card)));
  const topTotal = top.reduce((a, t) => a + t.amount, 0);

  function exportCSV() {
    const csv = toCSV(["Data", "Descrição", "Categoria", "Conta/Cartão", "Tipo", "Valor (R$)"], rows.map((r) => [formatDate(r.date), r.description, r.category, r.where, r.type, formatNumberBR(r.amount)]));
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `sr-strix-${isCash ? "fluxo-de-caixa" : "gastos-competencia"}-${from}-a-${to}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Relatórios" actions={<Button variant="outline" onClick={exportCSV} disabled={!rows.length}><Download className="h-4 w-4" /> Exportar CSV</Button>} />
      <div className="inline-flex rounded-lg border bg-card p-1" role="tablist" aria-label="Visão">
        {[["caixa", "Fluxo de caixa (data efetiva)"], ["competencia", "Gastos por competência"]].map(([k, l]) => (
          <button key={k} role="tab" aria-selected={s.view === k || (k === "caixa" && isCash)} onClick={() => set({ view: k })}
            className={`rounded-md px-3 py-1.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${(k === "caixa") === isCash ? "bg-primary text-primary-foreground" : ""}`}>{l}</button>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        {isCash ? "Entradas e saídas realizadas pela data em que o dinheiro entrou ou saiu. Pagamentos de fatura aparecem como saída; compras no cartão não." : "Despesas pela data de competência, pendentes ou realizadas. Parcelas de cartão contam no mês de vencimento da fatura; pagamentos de fatura não são somados de novo."}
      </p>
      <Panel>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Input aria-label="De" type="date" value={from} onChange={(e) => set({ from: e.target.value })} />
          <Input aria-label="Até" type="date" value={to} onChange={(e) => set({ to: e.target.value })} />
          <NativeSelect aria-label="Conta" value={s.account} onChange={(e) => set({ account: e.target.value })}><option value="">Todas as contas</option>{d.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</NativeSelect>
          <NativeSelect aria-label="Cartão" value={s.card} onChange={(e) => set({ card: e.target.value })}><option value="">Todos os cartões</option>{d.cards.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</NativeSelect>
          <NativeSelect aria-label="Categoria" value={s.category} onChange={(e) => set({ category: e.target.value })}><option value="">Todas as categorias</option>{d.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</NativeSelect>
        </div>
      </Panel>
      <div className="grid gap-4 sm:grid-cols-3">
        {isCash && <Panel><p className="text-sm text-muted-foreground">Entradas</p><p className="text-2xl font-semibold"><Money cents={inflow} tone="income" /></p></Panel>}
        <Panel><p className="text-sm text-muted-foreground">{isCash ? "Saídas" : "Total de gastos"}</p><p className="text-2xl font-semibold"><Money cents={outflow - (isCash ? 0 : inflow)} tone="expense" /></p></Panel>
        {isCash && <Panel><p className="text-sm text-muted-foreground">Resultado</p><p className="text-2xl font-semibold"><Money cents={inflow - outflow} tone="auto" /></p></Panel>}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Comparativo mensal" className="lg:col-span-2">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="mes" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                <Tooltip formatter={(v: number) => formatBRL(Math.round(v * 100))} contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
                <Legend />
                {isCash && <Bar dataKey="Entradas" fill="var(--success)" radius={[4, 4, 0, 0]} />}
                <Bar dataKey="Saídas" fill="var(--destructive)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Maiores categorias de gasto">
          {top.length === 0 ? <EmptyState title="Sem gastos no período" /> : (
            <ul className="space-y-3">
              {top.slice(0, 8).map((t) => (
                <li key={t.category_id} className="space-y-1 text-sm">
                  <div className="flex justify-between gap-2"><span>{cat.get(t.category_id)}</span><span><Money cents={t.amount} /> <span className="text-muted-foreground">({(pct(t.amount, topTotal) ?? 0).toFixed(0)}%)</span></span></div>
                  <ProgressBar value={pct(t.amount, topTotal) ?? 0} label={cat.get(t.category_id) ?? ""} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
      <Panel title="Registros">
        {rows.length === 0 ? <EmptyState title="Nenhum registro no período" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-muted-foreground"><th className="py-2 pr-3 font-medium">Data</th><th className="py-2 pr-3 font-medium">Descrição</th><th className="py-2 pr-3 font-medium">Categoria</th><th className="py-2 pr-3 font-medium">Conta/Cartão</th><th className="py-2 pr-3 font-medium">Tipo</th><th className="py-2 text-right font-medium">Valor</th></tr></thead>
              <tbody>
                {paged.rows.map((r, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2 pr-3 whitespace-nowrap">{formatDate(r.date)}</td><td className="py-2 pr-3">{r.description}</td><td className="py-2 pr-3">{r.category}</td><td className="py-2 pr-3">{r.where}</td><td className="py-2 pr-3">{r.type}</td>
                    <td className="py-2 text-right"><Money cents={r.amount} signed tone="auto" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager page={paged.page} pages={paged.pages} setPage={paged.setPage} total={rows.length} />
      </Panel>
    </div>
  );
}
