// Pure financial helpers. All money is integer cents; all dates are ISO "YYYY-MM-DD" strings
// (calendar dates, never Date objects) so no timezone shift can occur.

export const TZ = "America/Sao_Paulo";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export function formatBRL(cents: number): string {
  return brl.format(cents / 100).replace(/\u00a0/g, " ");
}
/** Plain number "1.234,56" for CSV. */
export function formatNumberBR(cents: number): string {
  const neg = cents < 0;
  const abs = Math.abs(cents);
  const int = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const frac = (abs % 100).toString().padStart(2, "0");
  return `${neg ? "-" : ""}${int},${frac}`;
}

/** Parses "1.234,56", "1234,5", "1234.56", "R$ 10" into cents. Returns null when invalid. */
export function parseBRL(input: string): number | null {
  let s = (input ?? "").replace(/R\$|\s/g, "").trim();
  if (!s) return null;
  const neg = s.startsWith("-");
  if (neg) s = s.slice(1);
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if ((s.match(/\./g) ?? []).length > 1 || /\.\d{3}$/.test(s)) s = s.replace(/\./g, "");
  if (!/^\d+(\.\d{0,2})?$/.test(s)) return null;
  const [i, f = ""] = s.split(".");
  const cents = Number(i) * 100 + Number((f + "00").slice(0, 2));
  return neg ? -cents : cents;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export function todayBR(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function daysInMonth(year: number, month1: number): number {
  return new Date(Date.UTC(year, month1, 0)).getUTCDate();
}
const pad = (n: number) => n.toString().padStart(2, "0");
export function ymd(year: number, month1: number, day: number) {
  return `${year}-${pad(month1)}-${pad(day)}`;
}
export function parts(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d };
}
/** First day of month of iso date. */
export function monthStart(iso: string) {
  const { y, m } = parts(iso);
  return ymd(y, m, 1);
}
export function monthEnd(iso: string) {
  const { y, m } = parts(iso);
  return ymd(y, m, daysInMonth(y, m));
}
export function addMonths(iso: string, n: number): string {
  const { y, m } = parts(iso);
  const idx = y * 12 + (m - 1) + n;
  return ymd(Math.floor(idx / 12), (idx % 12) + 1, 1);
}
/** Day `day` in the month of `iso`, clamped to the month's last day. */
export function clampDay(iso: string, day: number): string {
  const { y, m } = parts(iso);
  return ymd(y, m, Math.min(day, daysInMonth(y, m)));
}
export function monthsBetween(a: string, b: string) {
  const pa = parts(a);
  const pb = parts(b);
  return pb.y * 12 + pb.m - (pa.y * 12 + pa.m);
}
export function monthLabel(iso: string) {
  const { y, m } = parts(iso);
  const names = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${names[m - 1]}/${String(y).slice(2)}`;
}
export function monthLongLabel(iso: string) {
  const { y, m } = parts(iso);
  const names = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  return `${names[m - 1]} de ${y}`;
}

/** Splits a total into n installments summing exactly to total; extra cents go to the first ones. */
export function splitInstallments(totalCents: number, n: number): number[] {
  if (!Number.isInteger(totalCents) || totalCents <= 0) throw new Error("Valor deve ser positivo");
  if (!Number.isInteger(n) || n < 1) throw new Error("Parcelas inválidas");
  const base = Math.floor(totalCents / n);
  const rem = totalCents - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < rem ? 1 : 0));
}

/** Cycle rule: purchases before the closing day fall in the cycle closing that month; on/after it, the next. */
export function firstClosingMonth(purchaseDate: string, closingDay: number): string {
  const closing = clampDay(purchaseDate, closingDay);
  return purchaseDate < closing ? monthStart(purchaseDate) : addMonths(purchaseDate, 1);
}

/** Closing and due dates of the invoice closing in `closingMonth`. Due always after closing. */
export function invoiceDates(closingDay: number, dueDay: number, closingMonth: string) {
  const closing = clampDay(closingMonth, closingDay);
  let due = clampDay(closingMonth, dueDay);
  if (due <= closing) due = clampDay(addMonths(closingMonth, 1), dueDay);
  return { closing, due };
}

export type InvoiceStatus = "open" | "closed" | "partial" | "paid" | "overdue";
export function invoiceStatus(
  inv: { closing_date: string; due_date: string },
  totalCents: number,
  paidCents: number,
  today: string,
): InvoiceStatus {
  const remaining = totalCents - paidCents;
  if (paidCents > 0 && remaining <= 0) return "paid";
  if (remaining > 0 && today > inv.due_date) return "overdue";
  if (paidCents > 0) return "partial";
  if (today >= inv.closing_date) return totalCents <= 0 ? "paid" : "closed";
  return "open";
}
export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  open: "Aberta",
  closed: "Fechada",
  partial: "Parcialmente paga",
  paid: "Paga",
  overdue: "Vencida",
};

/** Monthly occurrence dates. Days 29–31 clamp to the month's last day without drifting. */
export function recurrenceOccurrences(
  startDate: string,
  dayOfMonth: number,
  endDate: string | null,
  until: string,
): { seq: number; date: string }[] {
  const out: { seq: number; date: string }[] = [];
  const limit = endDate && endDate < until ? endDate : until;
  for (let k = 0; k < 600; k++) {
    const date = clampDay(addMonths(startDate, k), dayOfMonth);
    if (date > limit) break;
    if (date >= startDate) out.push({ seq: k, date });
  }
  return out;
}

export type TxStatus = "pending" | "paid" | "cancelled";
export function txDisplayStatus(t: { status: string; due_date: string }, today: string) {
  if (t.status === "pending" && t.due_date < today) return "overdue" as const;
  return t.status as TxStatus;
}

export interface BalanceInputs {
  account: { id: string; opening_balance_cents: number };
  transactions: { account_id: string; kind: string; status: string; amount_cents: number; paid_date: string | null }[];
  transfers: { from_account_id: string; to_account_id: string; amount_cents: number; transfer_date: string }[];
  payments: { account_id: string; amount_cents: number; paid_date: string }[];
  until?: string;
}
/** Balance = opening + realized income − realized expense ± transfers − invoice payments (up to `until`). */
export function accountBalance({ account, transactions, transfers, payments, until }: BalanceInputs): number {
  const ok = (d: string | null) => !!d && (!until || d <= until);
  let b = account.opening_balance_cents;
  for (const t of transactions)
    if (t.account_id === account.id && t.status === "paid" && ok(t.paid_date))
      b += t.kind === "income" ? t.amount_cents : -t.amount_cents;
  for (const t of transfers) {
    if (!ok(t.transfer_date)) continue;
    if (t.to_account_id === account.id) b += t.amount_cents;
    if (t.from_account_id === account.id) b -= t.amount_cents;
  }
  for (const p of payments) if (p.account_id === account.id && ok(p.paid_date)) b -= p.amount_cents;
  return b;
}

/** Committed limit = all card installments (refunds negative) − payments on its invoices. */
export function cardCommitted(
  cardId: string,
  invoices: { id: string; card_id: string }[],
  installments: { invoice_id: string; amount_cents: number }[],
  payments: { invoice_id: string; amount_cents: number }[],
): number {
  const ids = new Set(invoices.filter((i) => i.card_id === cardId).map((i) => i.id));
  let c = 0;
  for (const i of installments) if (ids.has(i.invoice_id)) c += i.amount_cents;
  for (const p of payments) if (ids.has(p.invoice_id)) c -= p.amount_cents;
  return Math.max(0, c);
}

/** Percentage or null when there is no base. */
export function pct(part: number, base: number): number | null {
  if (!base || base <= 0) return null;
  return (part / base) * 100;
}

export function budgetLevel(used: number, limit: number): "ok" | "warn" | "over" {
  const p = pct(used, limit) ?? 0;
  if (p > 100) return "over";
  if (p >= 80) return "warn";
  return "ok";
}

export function toCSV(headers: string[], rows: (string | number)[][]): string {
  const esc = (v: string | number) => {
    const s = String(v ?? "");
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "\uFEFF" + [headers, ...rows].map((r) => r.map(esc).join(";")).join("\r\n");
}
