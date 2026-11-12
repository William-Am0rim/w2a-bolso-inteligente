import { describe, expect, it } from "vitest";
import type { FinanceData } from "./data";
import { competenceExpenses, monthTotals, invoiceInfos, balances } from "./selectors";
import { cardCommitted } from "./finance";

const base = (): FinanceData => ({
  profile: null, accounts: [], categories: [], transactions: [], transfers: [], recurrences: [], cards: [], invoices: [],
  purchases: [], installments: [], payments: [], budgets: [], goals: [], goalEntries: [],
});

describe("compra no cartão e pagamento da fatura", () => {
  // Card closes day 10, due day 20. Purchase R$ 1.200 in 3x on 2026-03-05.
  const d = base();
  d.accounts = [{ id: "a", opening_balance_cents: 500000, opening_date: "2026-01-01" } as never];
  d.cards = [{ id: "c", closing_day: 10, due_day: 20, limit_cents: 500000 } as never];
  d.invoices = [
    { id: "i1", card_id: "c", closing_month: "2026-03-01", closing_date: "2026-03-10", due_date: "2026-03-20" },
    { id: "i2", card_id: "c", closing_month: "2026-04-01", closing_date: "2026-04-10", due_date: "2026-04-20" },
    { id: "i3", card_id: "c", closing_month: "2026-05-01", closing_date: "2026-05-10", due_date: "2026-05-20" },
  ] as never;
  d.purchases = [{ id: "p", card_id: "c", category_id: "food", description: "TV", kind: "purchase" } as never];
  d.installments = [1, 2, 3].map((n) => ({ id: "x" + n, purchase_id: "p", invoice_id: "i" + n, number: n, total_count: 3, amount_cents: 40000 })) as never;
  d.payments = [{ id: "pay", invoice_id: "i1", account_id: "a", amount_cents: 40000, paid_date: "2026-03-18" }] as never;

  it("reduz o saldo bancário uma única vez", () => expect(balances(d, "2026-03-31").get("a")).toBe(460000));
  it("deixa R$ 800 comprometidos", () => expect(cardCommitted("c", d.invoices, d.installments, d.payments)).toBe(80000));
  it("preserva R$ 400 de gasto por competência no mês, sem duplicar o pagamento", () => {
    const items = competenceExpenses(d, "2026-03-01", "2026-03-31");
    expect(items.reduce((s, i) => s + i.amount, 0)).toBe(40000);
  });
  it("saídas de caixa contam o pagamento; a pagar não soma parcela já paga", () => {
    const t = monthTotals(d, "2026-03-01", "2026-03-19");
    expect(t.out).toBe(40000);
    expect(t.pendingOut).toBe(0);
    expect(monthTotals(d, "2026-04-01", "2026-03-19").pendingOut).toBe(40000);
  });
  it("pagamento parcial deixa saldo restante", () => {
    const d2 = { ...d, payments: [{ ...d.payments[0], amount_cents: 15000 }] };
    const i1 = invoiceInfos(d2, "2026-03-15").find((i) => i.id === "i1")!;
    expect(i1.remaining).toBe(25000);
    expect(i1.status).toBe("partial");
  });
});
