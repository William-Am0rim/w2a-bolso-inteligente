import type { FinanceData } from "./data";
import { accountBalance, invoiceStatus, monthStart, monthEnd, type InvoiceStatus } from "./finance";

export function balances(d: FinanceData, today: string) {
  const m = new Map<string, number>();
  for (const a of d.accounts) m.set(a.id, accountBalance({ account: a, transactions: d.transactions, transfers: d.transfers, payments: d.payments, until: today }));
  return m;
}
export function hasMovements(d: FinanceData, accountId: string) {
  return (
    d.transactions.some((t) => t.account_id === accountId) ||
    d.transfers.some((t) => t.from_account_id === accountId || t.to_account_id === accountId) ||
    d.payments.some((p) => p.account_id === accountId) ||
    d.recurrences.some((r) => r.account_id === accountId)
  );
}

export interface InvoiceInfo {
  id: string; card_id: string; closing_date: string; due_date: string; closing_month: string;
  total: number; paid: number; remaining: number; status: InvoiceStatus;
}
export function invoiceInfos(d: FinanceData, today: string): InvoiceInfo[] {
  const tot = new Map<string, number>();
  const paid = new Map<string, number>();
  for (const i of d.installments) tot.set(i.invoice_id, (tot.get(i.invoice_id) ?? 0) + i.amount_cents);
  for (const p of d.payments) paid.set(p.invoice_id, (paid.get(p.invoice_id) ?? 0) + p.amount_cents);
  return d.invoices
    .map((inv) => {
      const total = tot.get(inv.id) ?? 0;
      const pd = paid.get(inv.id) ?? 0;
      return { id: inv.id, card_id: inv.card_id, closing_date: inv.closing_date, due_date: inv.due_date, closing_month: inv.closing_month, total, paid: pd, remaining: Math.max(0, total - pd), status: invoiceStatus(inv, total, pd, today) };
    })
    .sort((a, b) => a.due_date.localeCompare(b.due_date));
}

/** Expense items by competence month: bank expenses (not cancelled) + card installments whose invoice is due that month. */
export interface CompetenceItem { date: string; description: string; category_id: string; amount: number; source: "bank" | "card"; account_id?: string; card_id?: string; label?: string; status?: string }
export function competenceExpenses(d: FinanceData, from: string, to: string): CompetenceItem[] {
  const out: CompetenceItem[] = [];
  for (const t of d.transactions)
    if (t.kind === "expense" && t.status !== "cancelled" && t.competence_date >= from && t.competence_date <= to)
      out.push({ date: t.competence_date, description: t.description, category_id: t.category_id, amount: t.amount_cents, source: "bank", account_id: t.account_id, status: t.status });
  const inv = new Map(d.invoices.map((i) => [i.id, i]));
  const pur = new Map(d.purchases.map((p) => [p.id, p]));
  for (const i of d.installments) {
    const iv = inv.get(i.invoice_id);
    const p = pur.get(i.purchase_id);
    if (!iv || !p) continue;
    const comp = monthStart(iv.due_date);
    if (comp >= monthStart(from) && comp <= to)
      out.push({ date: comp, description: p.description, category_id: p.category_id, amount: i.amount_cents, source: "card", card_id: p.card_id, label: `${i.number}/${i.total_count}` });
  }
  return out;
}

/** Cash movements by effective date. Transfers are listed separately (kind "transfer") and excluded from totals. */
export interface CashItem { date: string; description: string; amount: number; kind: "income" | "expense" | "invoice" | "transfer"; account_id: string; category_id?: string; card_id?: string }
export function cashFlow(d: FinanceData, from: string, to: string): CashItem[] {
  const out: CashItem[] = [];
  for (const t of d.transactions)
    if (t.status === "paid" && t.paid_date && t.paid_date >= from && t.paid_date <= to)
      out.push({ date: t.paid_date, description: t.description, amount: t.kind === "income" ? t.amount_cents : -t.amount_cents, kind: t.kind as "income", account_id: t.account_id, category_id: t.category_id });
  const inv = new Map(d.invoices.map((i) => [i.id, i]));
  const cards = new Map(d.cards.map((c) => [c.id, c]));
  for (const p of d.payments)
    if (p.paid_date >= from && p.paid_date <= to) {
      const iv = inv.get(p.invoice_id);
      out.push({ date: p.paid_date, description: `Pagamento fatura ${cards.get(iv?.card_id ?? "")?.name ?? ""}`.trim(), amount: -p.amount_cents, kind: "invoice", account_id: p.account_id, card_id: iv?.card_id });
    }
  for (const t of d.transfers)
    if (t.transfer_date >= from && t.transfer_date <= to) {
      out.push({ date: t.transfer_date, description: t.description || "Transferência enviada", amount: -t.amount_cents, kind: "transfer", account_id: t.from_account_id });
      out.push({ date: t.transfer_date, description: t.description || "Transferência recebida", amount: t.amount_cents, kind: "transfer", account_id: t.to_account_id });
    }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

export function monthTotals(d: FinanceData, month: string, today: string) {
  const from = monthStart(month);
  const to = monthEnd(month);
  const cf = cashFlow(d, from, to);
  const received = cf.filter((c) => c.kind === "income").reduce((s, c) => s + c.amount, 0);
  const out = -cf.filter((c) => c.kind === "expense" || c.kind === "invoice").reduce((s, c) => s + c.amount, 0);
  const pendingIn = d.transactions.filter((t) => t.kind === "income" && t.status === "pending" && t.due_date >= from && t.due_date <= to).reduce((s, t) => s + t.amount_cents, 0);
  const bankPendingOut = d.transactions.filter((t) => t.kind === "expense" && t.status === "pending" && t.due_date >= from && t.due_date <= to).reduce((s, t) => s + t.amount_cents, 0);
  const invRemaining = invoiceInfos(d, today).filter((i) => i.due_date >= from && i.due_date <= to).reduce((s, i) => s + i.remaining, 0);
  return { received, out, pendingIn, pendingOut: bankPendingOut + invRemaining, bankPendingOut, invRemaining };
}

export function sumByCategory(items: { category_id?: string; amount: number }[]) {
  const m = new Map<string, number>();
  for (const i of items) if (i.category_id) m.set(i.category_id, (m.get(i.category_id) ?? 0) + i.amount);
  return [...m.entries()].map(([category_id, amount]) => ({ category_id, amount })).filter((x) => x.amount > 0).sort((a, b) => b.amount - a.amount);
}
