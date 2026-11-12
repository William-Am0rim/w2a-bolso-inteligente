import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, ArrowDownCircle, ArrowUpCircle, CalendarClock, CheckCircle2, Landmark, Plus, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Money, PageHeader, Panel, ProgressBar, Tag, EmptyState } from "@/components/app/kit";
import { MonthPicker, WithData } from "@/components/app/WithData";
import { CategoryIcon } from "@/components/app/icons";
import { useTxDialog } from "@/components/app/AppShell";
import type { FinanceData } from "@/lib/data";
import { addMonths, budgetLevel, formatBRL, formatDate, monthEnd, monthLabel, monthStart, pct, todayBR, txDisplayStatus, INVOICE_STATUS_LABEL } from "@/lib/finance";
import { balances, competenceExpenses, invoiceInfos, monthTotals, sumByCategory } from "@/lib/selectors";

const search = z.object({ month: fallback(z.string(), "").default("") });

export const Route = createFileRoute("/_authenticated/dashboard")({
  validateSearch: zodValidator(search),
  head: () => ({ meta: [{ title: "Dashboard — W2A Finanças" }, { name: "description", content: "Resumo das suas finanças." }] }),
  component: () => <WithData>{(d) => <Dashboard d={d} />}</WithData>,
});

function Dashboard({ d }: { d: FinanceData }) {
  const { month: m } = Route.useSearch();
  const navigate = useNavigate({ from: "/dashboard" });
  const { openTx } = useTxDialog();
  const today = todayBR();
  const month = /^\d{4}-\d{2}-01$/.test(m) ? m : monthStart(today);
  const from = month;
  const to = monthEnd(month);

  const bal = balances(d, today);
  const activeAccounts = d.accounts.filter((a) => !a.archived);
  const totalToday = activeAccounts.reduce((s, a) => s + (bal.get(a.id) ?? 0), 0);
  const t = monthTotals(d, month, today);
  const chart = Array.from({ length: 6 }, (_, i) => {
    const mm = addMonths(month, i - 5);
    const x = monthTotals(d, mm, today);
    return { mes: monthLabel(mm), Receitas: x.received / 100, Saídas: x.out / 100 };
  });
  const catMap = new Map(d.categories.map((c) => [c.id, c]));
  const byCat = sumByCategory(competenceExpenses(d, from, to));
  const catTotal = byCat.reduce((s, c) => s + c.amount, 0);
  const invs = invoiceInfos(d, today);
  const cards = new Map(d.cards.map((c) => [c.id, c]));
  const overdue = d.transactions.filter((x) => txDisplayStatus(x, today) === "overdue").sort((a, b) => a.due_date.localeCompare(b.due_date));
  const upcoming = d.transactions.filter((x) => x.status === "pending" && x.due_date >= today && x.due_date <= addDays(today, 15)).sort((a, b) => a.due_date.localeCompare(b.due_date));
  const openInvoices = invs.filter((i) => i.remaining > 0 && i.status !== "open").concat(invs.filter((i) => i.status === "open" && i.total > 0)).slice(0, 5);
  const latest = [...d.transactions].filter((x) => x.status !== "cancelled").sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 6);
  const budgets = d.budgets.filter((b) => b.month === month);
  const compByCat = new Map(byCat.map((c) => [c.category_id, c.amount]));

  if (activeAccounts.length === 0 && d.transactions.length === 0) {
    return (
      <div>
        <PageHeader title={`Olá${d.profile?.display_name ? ", " + d.profile.display_name : ""}!`} description="Vamos começar a organizar suas finanças." />
        <Panel>
          <ol className="space-y-4">
            <li className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3"><Landmark className="h-6 w-6 text-primary" aria-hidden /><div><p className="font-medium">1. Cadastre sua primeira conta</p><p className="text-sm text-muted-foreground">Conta corrente, poupança ou carteira, com o saldo de abertura.</p></div></div>
              <Button asChild><Link to="/contas" search={{ novo: true }}>Criar conta</Link></Button>
            </li>
            <li className="flex flex-col gap-3 opacity-70 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3"><Plus className="h-6 w-6 text-primary" aria-hidden /><div><p className="font-medium">2. Registre um lançamento</p><p className="text-sm text-muted-foreground">Uma receita ou despesa para ver os indicadores ganharem vida.</p></div></div>
            </li>
          </ol>
        </Panel>
      </div>
    );
  }

  const lancLink = (extra: Record<string, string>) => ({ to: "/lancamentos" as const, search: { from, to, ...extra } });

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description={`Indicadores de ${monthLabel(month)}`} actions={<MonthPicker value={month} onChange={(v) => navigate({ search: { month: v } })} />} />
      {d.transactions.length === 0 && (
        <Panel className="border-primary/40 bg-accent">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm"><strong>Próximo passo:</strong> registre seu primeiro lançamento.</p>
            <Button onClick={() => openTx()}>Novo lançamento</Button>
          </div>
        </Panel>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Kpi to={{ to: "/contas" }} icon={<Wallet className="h-5 w-5" />} label="Saldo disponível hoje" value={totalToday} hint={formatDate(today)} />
        <Kpi to={{ to: "/relatorios", search: { view: "caixa", from, to } }} icon={<ArrowUpCircle className="h-5 w-5 text-success" />} label="Receitas recebidas" value={t.received} tone="income" />
        <Kpi to={{ to: "/relatorios", search: { view: "caixa", from, to } }} icon={<ArrowDownCircle className="h-5 w-5 text-destructive" />} label="Saídas de caixa" value={t.out} tone="expense" />
        <Kpi to={lancLink({ kind: "income", status: "pending" })} icon={<CalendarClock className="h-5 w-5 text-warning" />} label="A receber no mês" value={t.pendingIn} />
        <Kpi to={lancLink({ kind: "expense", status: "pending" })} icon={<CalendarClock className="h-5 w-5 text-warning" />} label="A pagar no mês" value={t.pendingOut} hint={t.invRemaining ? `inclui ${formatBRL(t.invRemaining)} em faturas` : undefined} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Receitas recebidas × saídas de caixa (6 meses)" className="lg:col-span-2">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="mes" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)} />
                <Tooltip formatter={(v: number) => formatBRL(Math.round(v * 100))} contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
                <Legend />
                <Bar dataKey="Receitas" fill="var(--success)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Saídas" fill="var(--destructive)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Gastos por categoria (competência)" action={<Link className="text-sm text-primary hover:underline" to="/relatorios" search={{ view: "competencia", from, to }}>Ver</Link>}>
          {byCat.length === 0 ? <EmptyState title="Sem gastos no mês" /> : (
            <ul className="space-y-3">
              {byCat.slice(0, 6).map((c) => {
                const cat = catMap.get(c.category_id);
                return (
                  <li key={c.category_id} className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="flex items-center gap-2">{cat && <CategoryIcon icon={cat.icon} color={cat.color} size={24} />}{cat?.name ?? "—"}</span>
                      <Money cents={c.amount} />
                    </div>
                    <ProgressBar value={pct(c.amount, catTotal) ?? 0} label={cat?.name ?? ""} />
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title={<span className="flex items-center gap-2">Pendências{overdue.length > 0 && <Tag tone="danger" icon={<AlertTriangle className="h-3 w-3" />}>{overdue.length} atrasada(s)</Tag>}</span>}>
          {overdue.length + upcoming.length === 0 ? <EmptyState title="Nada pendente nos próximos 15 dias" /> : (
            <ul className="divide-y">
              {[...overdue, ...upcoming].slice(0, 8).map((x) => (
                <li key={x.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{x.description}</p>
                    <p className={x.due_date < today ? "text-destructive" : "text-muted-foreground"}>{x.due_date < today ? "Atrasada · " : "Vence "}{formatDate(x.due_date)}</p>
                  </div>
                  <Money cents={x.kind === "income" ? x.amount_cents : -x.amount_cents} signed tone="auto" />
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Faturas" action={<Link className="text-sm text-primary hover:underline" to="/cartoes">Ver cartões</Link>}>
          {openInvoices.length === 0 ? <EmptyState title="Nenhuma fatura em aberto" /> : (
            <ul className="divide-y">
              {openInvoices.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <div>
                    <p className="font-medium">{cards.get(i.card_id)?.name}</p>
                    <p className="text-muted-foreground">Vence {formatDate(i.due_date)} · <Tag tone={i.status === "overdue" ? "danger" : i.status === "paid" ? "success" : i.status === "partial" || i.status === "closed" ? "warning" : "info"}>{INVOICE_STATUS_LABEL[i.status]}</Tag></p>
                  </div>
                  <Money cents={i.remaining} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Últimos lançamentos" action={<Link className="text-sm text-primary hover:underline" to="/lancamentos">Ver todos</Link>}>
          {latest.length === 0 ? <EmptyState title="Sem lançamentos" /> : (
            <ul className="divide-y">
              {latest.map((x) => (
                <li key={x.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{x.description}</p>
                    <p className="text-muted-foreground">{catMap.get(x.category_id)?.name} · {formatDate(x.due_date)}</p>
                  </div>
                  <Money cents={x.kind === "income" ? x.amount_cents : -x.amount_cents} signed tone="auto" />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Orçamentos do mês" action={<Link className="text-sm text-primary hover:underline" to="/orcamentos" search={{ month }}>Gerenciar</Link>}>
          {budgets.length === 0 ? <EmptyState title="Nenhum orçamento neste mês" /> : (
            <ul className="space-y-3">
              {budgets.map((b) => {
                const used = compByCat.get(b.category_id) ?? 0;
                const lvl = budgetLevel(used, b.limit_cents);
                return (
                  <li key={b.id} className="space-y-1 text-sm">
                    <div className="flex justify-between gap-2"><span>{catMap.get(b.category_id)?.name}</span><span className="tabular">{formatBRL(used)} / {formatBRL(b.limit_cents)}</span></div>
                    <ProgressBar value={pct(used, b.limit_cents) ?? 0} tone={lvl === "over" ? "danger" : lvl === "warn" ? "warning" : "primary"} label={catMap.get(b.category_id)?.name ?? ""} />
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
        <Panel title="Metas" action={<Link className="text-sm text-primary hover:underline" to="/metas">Gerenciar</Link>}>
          {d.goals.length === 0 ? <EmptyState title="Nenhuma meta cadastrada" /> : (
            <ul className="space-y-3">
              {d.goals.slice(0, 5).map((g) => {
                const saved = d.goalEntries.filter((e) => e.goal_id === g.id).reduce((s, e) => s + (e.kind === "deposit" ? e.amount_cents : -e.amount_cents), 0);
                const p = pct(saved, g.target_cents) ?? 0;
                return (
                  <li key={g.id} className="space-y-1 text-sm">
                    <div className="flex justify-between gap-2"><span className="flex items-center gap-1">{p >= 100 && <CheckCircle2 className="h-4 w-4 text-success" aria-label="Concluída" />}{g.name}</span><span className="tabular">{formatBRL(saved)} / {formatBRL(g.target_cents)}</span></div>
                    <ProgressBar value={p} tone={p >= 100 ? "success" : "primary"} label={g.name} />
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

function addDays(iso: string, n: number) {
  const dt = new Date(iso + "T12:00:00Z");
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

function Kpi({ to, icon, label, value, tone, hint }: { to: any; // eslint-disable-line @typescript-eslint/no-explicit-any
 icon: React.ReactNode; label: string; value: number; tone?: "income" | "expense"; hint?: string }) {
  return (
    <Link {...to} className="block rounded-xl border bg-card p-4 transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <div className="flex items-center justify-between text-sm text-muted-foreground"><span>{label}</span><span aria-hidden>{icon}</span></div>
      <p className="mt-2 text-2xl font-semibold"><Money cents={value} tone={tone} /></p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </Link>
  );
}
