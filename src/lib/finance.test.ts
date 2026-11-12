import { describe, expect, it } from "vitest";
import {
  accountBalance, cardCommitted, firstClosingMonth, formatBRL, invoiceDates, invoiceStatus,
  parseBRL, pct, recurrenceOccurrences, splitInstallments, toCSV, budgetLevel, formatDate, formatNumberBR,
} from "./finance";

describe("formatação", () => {
  it("BRL", () => expect(formatBRL(123456)).toBe("R$ 1.234,56"));
  it("data sem fuso", () => expect(formatDate("2026-03-01")).toBe("01/03/2026"));
  it("parse", () => {
    expect(parseBRL("1.234,56")).toBe(123456);
    expect(parseBRL("R$ 10")).toBe(1000);
    expect(parseBRL("0,1")).toBe(10);
    expect(parseBRL("abc")).toBeNull();
  });
});

describe("saldos", () => {
  const account = { id: "a", opening_balance_cents: 100000 };
  it("1.000 + 500 recebido − 200 pago = 1.300", () => {
    const b = accountBalance({
      account,
      transactions: [
        { account_id: "a", kind: "income", status: "paid", amount_cents: 50000, paid_date: "2026-01-02" },
        { account_id: "a", kind: "expense", status: "paid", amount_cents: 20000, paid_date: "2026-01-03" },
        { account_id: "a", kind: "expense", status: "pending", amount_cents: 99900, paid_date: null },
      ],
      transfers: [], payments: [],
    });
    expect(b).toBe(130000);
  });
  it("transferência preserva o consolidado", () => {
    const transfers = [{ from_account_id: "a", to_account_id: "b", amount_cents: 30000, transfer_date: "2026-01-04" }];
    const a = accountBalance({ account, transactions: [], transfers, payments: [] });
    const b = accountBalance({ account: { id: "b", opening_balance_cents: 0 }, transactions: [], transfers, payments: [] });
    expect(a).toBe(70000);
    expect(b).toBe(30000);
    expect(a + b).toBe(100000);
  });
});

describe("cartão", () => {
  it("1.200 em 3x = 3 × 400", () => expect(splitInstallments(120000, 3)).toEqual([40000, 40000, 40000]));
  it("100 em 3x soma exatamente 100", () => {
    const p = splitInstallments(10000, 3);
    expect(p).toEqual([3334, 3333, 3333]);
    expect(p.reduce((a, b) => a + b, 0)).toBe(10000);
  });
  it("compra antes do fechamento entra no ciclo do mês", () => expect(firstClosingMonth("2026-03-09", 10)).toBe("2026-03-01"));
  it("compra no dia do fechamento vai para o próximo", () => expect(firstClosingMonth("2026-03-10", 10)).toBe("2026-04-01"));
  it("virada de ano", () => expect(firstClosingMonth("2026-12-20", 15)).toBe("2027-01-01"));
  it("fevereiro com fechamento 30 usa último dia", () => {
    expect(firstClosingMonth("2026-02-27", 30)).toBe("2026-02-01");
    expect(firstClosingMonth("2026-02-28", 30)).toBe("2026-03-01");
    expect(invoiceDates(30, 5, "2026-02-01")).toEqual({ closing: "2026-02-28", due: "2026-03-05" });
  });
  it("vencimento depois do fechamento", () => expect(invoiceDates(5, 15, "2026-12-01")).toEqual({ closing: "2026-12-05", due: "2026-12-15" }));
  it("pagar 400 de 1.200 deixa 800 comprometidos", () => {
    const invoices = [{ id: "i1", card_id: "c" }, { id: "i2", card_id: "c" }, { id: "i3", card_id: "c" }];
    const inst = [{ invoice_id: "i1", amount_cents: 40000 }, { invoice_id: "i2", amount_cents: 40000 }, { invoice_id: "i3", amount_cents: 40000 }];
    expect(cardCommitted("c", invoices, inst, [])).toBe(120000);
    expect(cardCommitted("c", invoices, inst, [{ invoice_id: "i1", amount_cents: 40000 }])).toBe(80000);
  });
  it("estorno libera limite", () => {
    const invoices = [{ id: "i1", card_id: "c" }];
    expect(cardCommitted("c", invoices, [{ invoice_id: "i1", amount_cents: 10000 }, { invoice_id: "i1", amount_cents: -4000 }], [])).toBe(6000);
  });
  it("status de fatura", () => {
    const inv = { closing_date: "2026-03-10", due_date: "2026-03-20" };
    expect(invoiceStatus(inv, 1000, 0, "2026-03-05")).toBe("open");
    expect(invoiceStatus(inv, 1000, 0, "2026-03-10")).toBe("closed");
    expect(invoiceStatus(inv, 1000, 400, "2026-03-15")).toBe("partial");
    expect(invoiceStatus(inv, 1000, 400, "2026-03-21")).toBe("overdue");
    expect(invoiceStatus(inv, 1000, 1000, "2026-03-25")).toBe("paid");
  });
});

describe("recorrência", () => {
  it("dia 31 usa último dia e preserva o original", () => {
    const d = recurrenceOccurrences("2026-01-31", 31, null, "2026-04-30").map((o) => o.date);
    expect(d).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
  });
  it("executar duas vezes gera as mesmas chaves", () => {
    const a = recurrenceOccurrences("2026-01-05", 5, "2026-06-05", "2026-12-31");
    const b = recurrenceOccurrences("2026-01-05", 5, "2026-06-05", "2026-12-31");
    expect(a).toEqual(b);
    expect(a.length).toBe(6);
  });
});

describe("percentuais e CSV", () => {
  it("sem base retorna null", () => expect(pct(10, 0)).toBeNull());
  it("80% alerta, >100% estourado", () => {
    expect(budgetLevel(80, 100)).toBe("warn");
    expect(budgetLevel(101, 100)).toBe("over");
  });
  it("csv com ; e BOM", () => {
    expect(toCSV(["Descrição", "Valor"], [["Café; pão", formatNumberBR(123456)]])).toBe('\uFEFFDescrição;Valor\r\n"Café; pão";1.234,56');
  });
});
