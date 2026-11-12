import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { addMonths, recurrenceOccurrences, todayBR } from "./finance";

type T<N extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][N]["Row"];
export type Account = T<"accounts">;
export type Category = T<"categories">;
export type Tx = T<"transactions">;
export type Transfer = T<"transfers">;
export type Recurrence = T<"recurrences">;
export type Card = T<"cards">;
export type Invoice = T<"invoices">;
export type Purchase = T<"card_purchases">;
export type Installment = T<"installments">;
export type InvoicePayment = T<"invoice_payments">;
export type Budget = T<"budgets">;
export type Goal = T<"goals">;
export type GoalEntry = T<"goal_entries">;
export type Profile = T<"profiles">;

export interface FinanceData {
  profile: Profile | null;
  accounts: Account[];
  categories: Category[];
  transactions: Tx[];
  transfers: Transfer[];
  recurrences: Recurrence[];
  cards: Card[];
  invoices: Invoice[];
  purchases: Purchase[];
  installments: Installment[];
  payments: InvoicePayment[];
  budgets: Budget[];
  goals: Goal[];
  goalEntries: GoalEntry[];
}

async function fetchAll<N extends keyof Database["public"]["Tables"]>(table: N): Promise<T<N>[]> {
  const out: T<N>[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select("*").range(from, from + 999);
    if (error) throw error;
    out.push(...((data ?? []) as unknown as T<N>[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export const FINANCE_KEY = ["finance"] as const;

async function loadFinance(): Promise<FinanceData> {
  const [profiles, accounts, categories, transactions, transfers, recurrences, cards, invoices, purchases, installments, payments, budgets, goals, goalEntries] =
    await Promise.all([
      fetchAll("profiles"), fetchAll("accounts"), fetchAll("categories"), fetchAll("transactions"), fetchAll("transfers"),
      fetchAll("recurrences"), fetchAll("cards"), fetchAll("invoices"), fetchAll("card_purchases"), fetchAll("installments"),
      fetchAll("invoice_payments"), fetchAll("budgets"), fetchAll("goals"), fetchAll("goal_entries"),
    ]);
  return { profile: profiles[0] ?? null, accounts, categories, transactions, transfers, recurrences, cards, invoices, purchases, installments, payments, budgets, goals, goalEntries };
}

export function useFinance() {
  return useQuery({ queryKey: FINANCE_KEY, queryFn: loadFinance, staleTime: 30_000 });
}
export function useRefresh() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: FINANCE_KEY });
}

export const RECURRENCE_HORIZON_MONTHS = 3;

/** Idempotent: unique (recurrence_id, recurrence_seq) means re-running never duplicates. */
export async function generateRecurrences(recs: Recurrence[], userId: string) {
  const until = addMonths(todayBR(), RECURRENCE_HORIZON_MONTHS + 1);
  const rows = recs
    .filter((r) => r.active && r.account_id && r.category_id)
    .flatMap((r) =>
      recurrenceOccurrences(r.start_date, r.day_of_month, r.end_date, until).map((o) => ({
        user_id: userId,
        kind: r.kind,
        description: r.description,
        amount_cents: r.amount_cents,
        category_id: r.category_id!,
        account_id: r.account_id!,
        payment_method: r.payment_method,
        status: "pending",
        competence_date: o.date,
        due_date: o.date,
        notes: r.notes,
        recurrence_id: r.id,
        recurrence_seq: o.seq,
      })),
    );
  if (!rows.length) return 0;
  const { error } = await supabase.from("transactions").upsert(rows, { onConflict: "recurrence_id,recurrence_seq", ignoreDuplicates: true });
  if (error) throw error;
  return rows.length;
}

export function errMsg(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) {
    const m = String((e as { message: string }).message);
    if (m.includes("duplicate key")) return "Registro já existe.";
    if (m.includes("violates foreign key")) return "Este registro está vinculado a outros dados.";
    return m;
  }
  return "Erro inesperado.";
}

export const PAYMENT_METHODS: Record<string, string> = {
  pix: "Pix", cash: "Dinheiro", debit: "Débito", credit: "Crédito", boleto: "Boleto", other: "Outra",
};
export const ACCOUNT_TYPES: Record<string, string> = { checking: "Conta corrente", savings: "Poupança", wallet: "Carteira" };
