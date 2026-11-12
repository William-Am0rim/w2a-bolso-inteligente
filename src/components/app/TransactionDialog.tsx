import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Field, FormModal, MoneyInput, NativeSelect, centsToInput, newKey } from "./kit";
import { errMsg, generateRecurrences, PAYMENT_METHODS, useFinance, useRefresh, type Tx } from "@/lib/data";
import {
  addMonths, firstClosingMonth, formatBRL, formatDate, invoiceDates, monthLongLabel, parseBRL, splitInstallments, todayBR,
} from "@/lib/finance";

export interface TxDialogInit {
  kind?: "income" | "expense";
  tx?: Tx;
  cardId?: string;
  accountId?: string;
}

type Errors = Record<string, string>;

export function TransactionDialog({ open, onOpenChange, init }: { open: boolean; onOpenChange: (o: boolean) => void; init: TxDialogInit }) {
  const { data } = useFinance();
  const refresh = useRefresh();
  const editing = init.tx;
  const today = todayBR();

  const [kind, setKind] = useState<"income" | "expense">("expense");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [method, setMethod] = useState("pix");
  const [accountId, setAccountId] = useState("");
  const [status, setStatus] = useState("pending");
  const [competence, setCompetence] = useState(today);
  const [due, setDue] = useState(today);
  const [paidDate, setPaidDate] = useState(today);
  const [notes, setNotes] = useState("");
  const [recurring, setRecurring] = useState(false);
  const [recEnd, setRecEnd] = useState("");
  const [scope, setScope] = useState<"one" | "following">("one");
  // credit
  const [cardId, setCardId] = useState("");
  const [installments, setInstallments] = useState("1");
  const [purchaseDate, setPurchaseDate] = useState(today);
  const [firstMonth, setFirstMonth] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [clientKey, setClientKey] = useState(newKey());

  const accounts = (data?.accounts ?? []).filter((a) => !a.archived || a.id === editing?.account_id);
  const cards = (data?.cards ?? []).filter((c) => !c.archived);
  const categories = (data?.categories ?? []).filter((c) => c.kind === kind && (!c.archived || c.id === editing?.category_id));
  const isCredit = !editing && kind === "expense" && method === "credit";

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setClientKey(newKey());
    setScope("one");
    const t = init.tx;
    if (t) {
      setKind(t.kind as "income");
      setDescription(t.description);
      setAmount(centsToInput(t.amount_cents));
      setCategoryId(t.category_id);
      setMethod(t.payment_method);
      setAccountId(t.account_id);
      setStatus(t.status);
      setCompetence(t.competence_date);
      setDue(t.due_date);
      setPaidDate(t.paid_date ?? today);
      setNotes(t.notes ?? "");
      setRecurring(false);
    } else {
      setKind(init.kind ?? (init.cardId ? "expense" : "expense"));
      setDescription(""); setAmount(""); setCategoryId(""); setNotes("");
      setMethod(init.cardId ? "credit" : "pix");
      setAccountId(init.accountId ?? data?.accounts.find((a) => !a.archived)?.id ?? "");
      setCardId(init.cardId ?? cards[0]?.id ?? "");
      setStatus("pending"); setCompetence(today); setDue(today); setPaidDate(today);
      setRecurring(false); setRecEnd(""); setInstallments("1"); setPurchaseDate(today); setFirstMonth("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, init]);

  const card = cards.find((c) => c.id === cardId);
  const autoFirst = card ? firstClosingMonth(purchaseDate, card.closing_day) : "";
  const chosenFirst = firstMonth || autoFirst;
  const preview = useMemo(() => {
    const total = parseBRL(amount);
    const n = Number(installments);
    if (!card || !total || total <= 0 || !Number.isInteger(n) || n < 1 || n > 48 || total < n) return null;
    return splitInstallments(total, n).map((v, i) => {
      const m = addMonths(chosenFirst, i);
      return { n: i + 1, v, ...invoiceDates(card.closing_day, card.due_day, m) };
    });
  }, [amount, installments, card, chosenFirst]);

  function validate(): Errors {
    const e: Errors = {};
    const cents = parseBRL(amount);
    if (!description.trim()) e.description = "Informe a descrição.";
    if (cents === null || cents <= 0) e.amount = "Informe um valor positivo.";
    if (!categoryId) e.category = "Selecione a categoria.";
    if (isCredit) {
      if (!cardId) e.card = "Selecione o cartão.";
      const n = Number(installments);
      if (!Number.isInteger(n) || n < 1 || n > 48) e.installments = "Entre 1 e 48 parcelas.";
      else if (cents && cents < n) e.installments = "Valor insuficiente para as parcelas.";
      if (!purchaseDate) e.purchaseDate = "Informe a data.";
    } else {
      if (!accountId) e.account = "Selecione a conta.";
      if (!competence) e.competence = "Informe a competência.";
      if (!due) e.due = "Informe o vencimento.";
      if (status === "paid") {
        const acc = accounts.find((a) => a.id === accountId);
        if (!paidDate) e.paidDate = "Informe a data efetiva.";
        else if (acc && paidDate < acc.opening_date) e.paidDate = `Anterior ao saldo de abertura (${formatDate(acc.opening_date)}).`;
      }
    }
    return e;
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (busy || !data?.profile) return;
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    const cents = parseBRL(amount)!;
    try {
      if (isCredit) {
        const { error } = await supabase.rpc("create_card_purchase", {
          p_card: cardId, p_category: categoryId, p_description: description.trim(), p_purchase_date: purchaseDate,
          p_total_cents: cents, p_installments: Number(installments), p_first_closing_month: chosenFirst,
          p_notes: notes || "", p_client_key: clientKey,
        });
        if (error) throw error;
        toast.success("Compra no cartão registrada.");
      } else {
        const base = {
          kind, description: description.trim(), amount_cents: cents, category_id: categoryId, account_id: accountId,
          payment_method: method, notes: notes || null,
        };
        if (editing) {
          const row = { ...base, status, competence_date: competence, due_date: due, paid_date: status === "paid" ? paidDate : null };
          if (scope === "following" && editing.recurrence_id && editing.recurrence_seq !== null) {
            // Future pending occurrences get the new values; realized ones are preserved.
            const { error: e1 } = await supabase.from("transactions").update(base)
              .eq("recurrence_id", editing.recurrence_id).gte("recurrence_seq", editing.recurrence_seq).eq("status", "pending");
            if (e1) throw e1;
            const { error: e2 } = await supabase.from("transactions").update(row).eq("id", editing.id);
            if (e2) throw e2;
            const { error: e3 } = await supabase.from("recurrences").update({
              kind, description: base.description, amount_cents: cents, category_id: categoryId, account_id: accountId, payment_method: method, notes: base.notes,
            }).eq("id", editing.recurrence_id);
            if (e3) throw e3;
          } else {
            const { error } = await supabase.from("transactions").update(row).eq("id", editing.id);
            if (error) throw error;
          }
          toast.success("Lançamento atualizado.");
        } else if (recurring) {
          if (recEnd && recEnd < due) { setErrors({ recEnd: "Término antes do início." }); setBusy(false); return; }
          const day = Number(due.slice(8, 10));
          const { data: rec, error } = await supabase.from("recurrences").insert({
            user_id: data.profile.id, kind, description: base.description, amount_cents: cents, category_id: categoryId,
            account_id: accountId, payment_method: method, day_of_month: day, start_date: due, end_date: recEnd || null, notes: base.notes,
          }).select().single();
          if (error) throw error;
          await generateRecurrences([rec], data.profile.id);
          if (status === "paid") {
            await supabase.from("transactions").update({ status: "paid", paid_date: paidDate })
              .eq("recurrence_id", rec.id).eq("recurrence_seq", 0);
          }
          toast.success("Recorrência mensal criada.");
        } else {
          const { error } = await supabase.from("transactions").insert({
            ...base, user_id: data.profile.id, status, competence_date: competence, due_date: due,
            paid_date: status === "paid" ? paidDate : null, client_key: clientKey,
          });
          if (error && !String(error.message).includes("client_key")) throw error;
          toast.success(kind === "income" ? "Receita registrada." : "Despesa registrada.");
        }
      }
      await refresh();
      onOpenChange(false);
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  const noAccounts = !editing && !isCredit && accounts.length === 0;

  return (
    <FormModal open={open} onOpenChange={onOpenChange} title={editing ? "Editar lançamento" : "Novo lançamento"}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {!editing && (
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Tipo">
            {(["expense", "income"] as const).map((k) => (
              <button type="button" key={k} role="radio" aria-checked={kind === k}
                onClick={() => { setKind(k); setCategoryId(""); if (k === "income" && method === "credit") setMethod("pix"); }}
                className={`rounded-lg border px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${kind === k ? (k === "income" ? "border-success bg-success-soft text-success" : "border-destructive bg-danger-soft text-destructive") : "bg-background"}`}>
                {k === "income" ? "↑ Receita" : "↓ Despesa"}
              </button>
            ))}
          </div>
        )}
        <Field label="Descrição" htmlFor="tx-desc" error={errors.description}>
          <Input id="tx-desc" value={description} onChange={(e) => setDescription(e.target.value)} aria-invalid={!!errors.description} maxLength={120} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={isCredit ? "Valor total da compra" : "Valor"} htmlFor="tx-amount" error={errors.amount}>
            <MoneyInput id="tx-amount" value={amount} onChange={setAmount} invalid={!!errors.amount} />
          </Field>
          <Field label="Categoria" htmlFor="tx-cat" error={errors.category}>
            <NativeSelect id="tx-cat" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} aria-invalid={!!errors.category}>
              <option value="">Selecione</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </NativeSelect>
          </Field>
        </div>
        <Field label="Forma de pagamento" htmlFor="tx-method">
          <NativeSelect id="tx-method" value={method} onChange={(e) => setMethod(e.target.value)} disabled={!!editing && false}>
            {Object.entries(PAYMENT_METHODS).filter(([k]) => k !== "credit" || (kind === "expense" && !editing)).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </NativeSelect>
        </Field>

        {isCredit ? (
          <>
            {cards.length === 0 ? (
              <p className="rounded-lg bg-warning-soft p-3 text-sm">Cadastre um cartão em Cartões para lançar compras no crédito.</p>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Cartão" htmlFor="tx-card" error={errors.card} className="sm:col-span-1">
                    <NativeSelect id="tx-card" value={cardId} onChange={(e) => { setCardId(e.target.value); setFirstMonth(""); }}>
                      {cards.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </NativeSelect>
                  </Field>
                  <Field label="Data da compra" htmlFor="tx-pdate" error={errors.purchaseDate}>
                    <Input id="tx-pdate" type="date" value={purchaseDate} onChange={(e) => { setPurchaseDate(e.target.value); setFirstMonth(""); }} />
                  </Field>
                  <Field label="Parcelas" htmlFor="tx-inst" error={errors.installments}>
                    <Input id="tx-inst" type="number" min={1} max={48} value={installments} onChange={(e) => setInstallments(e.target.value)} />
                  </Field>
                </div>
                {card && (
                  <Field label="Primeira fatura" htmlFor="tx-first" hint="Calculada pelo ciclo do cartão; ajuste se necessário.">
                    <NativeSelect id="tx-first" value={chosenFirst} onChange={(e) => setFirstMonth(e.target.value)}>
                      {[-1, 0, 1, 2].map((d) => {
                        const m = addMonths(autoFirst, d);
                        const dts = invoiceDates(card.closing_day, card.due_day, m);
                        return <option key={m} value={m}>Fecha {formatDate(dts.closing)} · vence {formatDate(dts.due)}{d === 0 ? " (automática)" : ""}</option>;
                      })}
                    </NativeSelect>
                  </Field>
                )}
                {preview && (
                  <div className="rounded-lg border bg-muted/50 p-3 text-sm" aria-live="polite">
                    <p className="mb-2 font-medium">Previsão das parcelas</p>
                    <ul className="max-h-40 space-y-1 overflow-y-auto">
                      {preview.map((p) => (
                        <li key={p.n} className="flex justify-between gap-2">
                          <span>{p.n}/{preview.length} · fatura {monthLongLabel(p.due)} (vence {formatDate(p.due)})</span>
                          <span className="tabular">{formatBRL(p.v)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          <>
            {noAccounts ? (
              <p className="rounded-lg bg-warning-soft p-3 text-sm">Cadastre uma conta em Contas antes de lançar movimentações bancárias.</p>
            ) : (
              <Field label="Conta" htmlFor="tx-acc" error={errors.account}>
                <NativeSelect id="tx-acc" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                  <option value="">Selecione</option>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </NativeSelect>
              </Field>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Competência" htmlFor="tx-comp" error={errors.competence}>
                <Input id="tx-comp" type="date" value={competence} onChange={(e) => setCompetence(e.target.value)} />
              </Field>
              <Field label="Vencimento" htmlFor="tx-due" error={errors.due}>
                <Input id="tx-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Situação" htmlFor="tx-status">
                <NativeSelect id="tx-status" value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="pending">Pendente</option>
                  <option value="paid">{kind === "income" ? "Recebida" : "Paga"}</option>
                  {editing && <option value="cancelled">Cancelada</option>}
                </NativeSelect>
              </Field>
              {status === "paid" && (
                <Field label={kind === "income" ? "Data do recebimento" : "Data do pagamento"} htmlFor="tx-paid" error={errors.paidDate}>
                  <Input id="tx-paid" type="date" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} />
                </Field>
              )}
            </div>
            {!editing && (
              <div className="space-y-3 rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <Checkbox id="tx-rec" checked={recurring} onCheckedChange={(v) => setRecurring(!!v)} />
                  <Label htmlFor="tx-rec">Repetir todo mês (usa o dia do vencimento)</Label>
                </div>
                {recurring && (
                  <Field label="Término (opcional)" htmlFor="tx-recend" error={errors.recEnd}>
                    <Input id="tx-recend" type="date" value={recEnd} onChange={(e) => setRecEnd(e.target.value)} />
                  </Field>
                )}
              </div>
            )}
            {editing?.recurrence_id && (
              <fieldset className="space-y-2 rounded-lg border p-3">
                <legend className="px-1 text-sm font-medium">Aplicar alterações em</legend>
                {(["one", "following"] as const).map((s) => (
                  <label key={s} className="flex items-center gap-2 text-sm">
                    <input type="radio" name="scope" checked={scope === s} onChange={() => setScope(s)} />
                    {s === "one" ? "Esta ocorrência" : "Esta e as próximas (realizadas são preservadas)"}
                  </label>
                ))}
              </fieldset>
            )}
          </>
        )}
        <Field label="Observações" htmlFor="tx-notes">
          <Textarea id="tx-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={500} />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="submit" disabled={busy || noAccounts || (isCredit && cards.length === 0)}>{busy ? "Salvando..." : "Salvar"}</Button>
        </div>
      </form>
    </FormModal>
  );
}
