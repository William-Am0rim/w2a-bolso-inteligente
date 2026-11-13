import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Archive, ArchiveRestore, CreditCard, Pencil, Plus, Receipt, RotateCcw, Trash2, Undo2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Confirm, EmptyState, Field, FormModal, Money, MoneyInput, NativeSelect, PageHeader, Panel, ProgressBar, Tag, centsToInput, newKey } from "@/components/app/kit";
import { WithData } from "@/components/app/WithData";
import { COLOR_CHOICES, ColorPicker } from "@/components/app/icons";
import { useTxDialog } from "@/components/app/AppShell";
import { errMsg, useRefresh, type Card, type FinanceData, type Purchase } from "@/lib/data";
import { cardCommitted, firstClosingMonth, formatBRL, formatDate, INVOICE_STATUS_LABEL, monthLongLabel, parseBRL, pct, todayBR, type InvoiceStatus } from "@/lib/finance";
import { invoiceInfos, type InvoiceInfo } from "@/lib/selectors";

const search = z.object({ card: fallback(z.string(), "").default(""), invoice: fallback(z.string(), "").default("") });

export const Route = createFileRoute("/_authenticated/finance/cards")({
  validateSearch: zodValidator(search),
  head: () => ({ meta: [{ title: "Cartões — Sr. Strix Finanças" }, { name: "description", content: "Cartões de crédito, faturas e parcelas." }, { property: "og:title", content: "Cartões — Sr. Strix Finanças" }, { property: "og:description", content: "Cartões de crédito, faturas e parcelas." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: () => <WithData>{(d) => <Cartoes d={d} />}</WithData>,
});

const tone = (s: InvoiceStatus) => (s === "paid" ? "success" : s === "overdue" ? "danger" : s === "open" ? "info" : "warning") as "success";

function Cartoes({ d }: { d: FinanceData }) {
  const s = Route.useSearch();
  const navigate = useNavigate({ from: "/finance/cards" });
  const refresh = useRefresh();
  const { openTx } = useTxDialog();
  const today = todayBR();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Card | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [refund, setRefund] = useState<Purchase | null>(null);

  const cards = d.cards.filter((c) => !c.archived || c.id === s.card);
  const card = cards.find((c) => c.id === s.card) ?? cards.find((c) => !c.archived) ?? cards[0];
  const infos = invoiceInfos(d, today);
  const cardInvs = card ? infos.filter((i) => i.card_id === card.id) : [];
  const defaultInv = cardInvs.find((i) => i.status !== "paid" && i.total > 0) ?? cardInvs.find((i) => i.due_date >= today) ?? cardInvs[cardInvs.length - 1];
  const inv = cardInvs.find((i) => i.id === s.invoice) ?? defaultInv;
  const purMap = new Map(d.purchases.map((p) => [p.id, p]));
  const catMap = new Map(d.categories.map((c) => [c.id, c]));
  const items = inv ? d.installments.filter((i) => i.invoice_id === inv.id).sort((a, b) => (purMap.get(a.purchase_id)?.purchase_date ?? "").localeCompare(purMap.get(b.purchase_id)?.purchase_date ?? "")) : [];
  const pays = inv ? d.payments.filter((p) => p.invoice_id === inv.id) : [];
  const accName = new Map(d.accounts.map((a) => [a.id, a.name]));
  const purchases = card ? d.purchases.filter((p) => p.card_id === card.id && p.kind === "purchase").sort((a, b) => b.purchase_date.localeCompare(a.purchase_date)) : [];

  async function act(p: PromiseLike<{ error: unknown }>, msg: string) {
    const { error } = await p;
    if (error) return toast.error(errMsg(error));
    toast.success(msg); refresh();
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Cartões" description="Limite, faturas e parcelas."
        actions={<>
          {card && <Button variant="outline" onClick={() => openTx({ cardId: card.id, kind: "expense" })}><Plus className="h-4 w-4" /> Nova compra</Button>}
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="h-4 w-4" /> Novo cartão</Button>
        </>} />
      {cards.length === 0 ? (
        <Panel><EmptyState title="Nenhum cartão cadastrado" description="Cadastre um cartão com limite, dia de fechamento e vencimento." action={<Button onClick={() => { setEditing(null); setFormOpen(true); }}>Cadastrar cartão</Button>} /></Panel>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {d.cards.filter((c) => !c.archived || c.id === card?.id).map((c) => {
              const committed = cardCommitted(c.id, d.invoices, d.installments, d.payments);
              const avail = c.limit_cents - committed;
              const selected = c.id === card?.id;
              return (
                <div key={c.id} className={`rounded-xl border bg-card p-4 ${selected ? "ring-2 ring-primary" : ""}`}>
                  <button className="w-full text-left focus-visible:outline-none" onClick={() => navigate({ search: { card: c.id, invoice: "" } })} aria-pressed={selected}>
                    <div className="flex items-center gap-2"><CreditCard className="h-5 w-5" style={{ color: c.color }} aria-hidden /><span className="font-semibold">{c.name}</span>{c.archived && <Tag>Arquivado</Tag>}</div>
                    <p className="mt-1 text-xs text-muted-foreground">Fecha dia {c.closing_day} · vence dia {c.due_day}</p>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                      <div><p className="text-muted-foreground">Limite</p><Money cents={c.limit_cents} className="text-sm font-medium" /></div>
                      <div><p className="text-muted-foreground">Comprometido</p><Money cents={committed} tone="expense" className="text-sm font-medium" /></div>
                      <div><p className="text-muted-foreground">Disponível</p><Money cents={avail} tone={avail < 0 ? "expense" : "income"} className="text-sm font-medium" /></div>
                    </div>
                    <div className="mt-2"><ProgressBar value={pct(committed, c.limit_cents) ?? 0} tone={committed > c.limit_cents ? "danger" : "primary"} label={`Uso do limite ${c.name}`} /></div>
                  </button>
                  <div className="mt-2 flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => { setEditing(c); setFormOpen(true); }}><Pencil className="h-4 w-4" /> Editar</Button>
                    <Button size="sm" variant="ghost" onClick={() => act(supabase.from("cards").update({ archived: !c.archived }).eq("id", c.id), c.archived ? "Cartão reativado." : "Cartão arquivado.")}>
                      {c.archived ? <><ArchiveRestore className="h-4 w-4" /> Reativar</> : <><Archive className="h-4 w-4" /> Arquivar</>}
                    </Button>
                    {!d.purchases.some((p) => p.card_id === c.id) && (
                      <Confirm title={`Excluir ${c.name}?`} onConfirm={() => act(supabase.from("cards").delete().eq("id", c.id), "Cartão excluído.")}
                        trigger={<Button size="sm" variant="ghost" className="text-destructive"><Trash2 className="h-4 w-4" /> Excluir</Button>} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {card && (
            <div className="grid gap-4 lg:grid-cols-3">
              <Panel title="Faturas">
                {cardInvs.length === 0 ? <EmptyState title="Sem faturas" description="Faturas são criadas ao lançar compras." /> : (
                  <ul className="max-h-[28rem] space-y-1 overflow-y-auto">
                    {cardInvs.map((i) => (
                      <li key={i.id}>
                        <button onClick={() => navigate({ search: { card: card.id, invoice: i.id } })} aria-current={inv?.id === i.id}
                          className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${inv?.id === i.id ? "bg-accent" : ""}`}>
                          <span><span className="block font-medium">{monthLongLabel(i.due_date)}</span><Tag tone={tone(i.status)}>{INVOICE_STATUS_LABEL[i.status]}</Tag></span>
                          <Money cents={i.total} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
              <Panel className="lg:col-span-2" title={inv ? `Fatura de ${monthLongLabel(inv.due_date)}` : "Fatura"}
                action={inv && inv.remaining > 0 && <Button size="sm" onClick={() => setPayOpen(true)}><Receipt className="h-4 w-4" /> Pagar fatura</Button>}>
                {!inv ? <EmptyState title="Selecione uma fatura" /> : (
                  <>
                    <div className="mb-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                      <div><p className="text-muted-foreground">Fechamento</p><p>{formatDate(inv.closing_date)}</p></div>
                      <div><p className="text-muted-foreground">Vencimento</p><p>{formatDate(inv.due_date)}</p></div>
                      <div><p className="text-muted-foreground">Total</p><Money cents={inv.total} className="font-medium" /></div>
                      <div><p className="text-muted-foreground">Restante</p><Money cents={inv.remaining} tone={inv.remaining > 0 ? "expense" : "income"} className="font-medium" /></div>
                    </div>
                    {items.length === 0 ? <EmptyState title="Fatura sem itens" /> : (
                      <ul className="divide-y">
                        {items.map((i) => {
                          const p = purMap.get(i.purchase_id);
                          return (
                            <li key={i.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                              <div className="min-w-0">
                                <p className="truncate font-medium">{p?.description} <span className="text-xs text-muted-foreground">{i.number}/{i.total_count}</span></p>
                                <p className="text-xs text-muted-foreground">{formatDate(p?.purchase_date)} · {catMap.get(p?.category_id ?? "")?.name}</p>
                              </div>
                              <Money cents={i.amount_cents} tone={i.amount_cents < 0 ? "income" : undefined} />
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    {pays.length > 0 && (
                      <div className="mt-4 border-t pt-3">
                        <p className="mb-2 text-sm font-medium">Pagamentos</p>
                        <ul className="space-y-1 text-sm">
                          {pays.map((p) => (
                            <li key={p.id} className="flex items-center justify-between gap-2">
                              <span>{formatDate(p.paid_date)} · {accName.get(p.account_id)}</span>
                              <span className="flex items-center gap-1"><Money cents={p.amount_cents} tone="income" />
                                <Confirm title="Desfazer pagamento?" description="O valor volta para a conta e para o saldo da fatura." confirmLabel="Desfazer"
                                  onConfirm={() => act(supabase.from("invoice_payments").delete().eq("id", p.id), "Pagamento desfeito.")}
                                  trigger={<Button size="icon" variant="ghost" aria-label="Desfazer pagamento"><Undo2 className="h-4 w-4" /></Button>} />
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}
              </Panel>
            </div>
          )}

          {card && (
            <Panel title="Compras do cartão">
              {purchases.length === 0 ? <EmptyState title="Nenhuma compra" action={<Button onClick={() => openTx({ cardId: card.id })}>Lançar compra</Button>} /> : (
                <ul className="divide-y">
                  {purchases.map((p) => {
                    const refunded = d.purchases.filter((r) => r.refund_of === p.id).reduce((x, r) => x + r.total_cents, 0);
                    return (
                      <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                        <div className="min-w-0">
                          <p className="font-medium">{p.description} <span className="text-xs text-muted-foreground">{p.installments}x</span></p>
                          <p className="text-xs text-muted-foreground">{formatDate(p.purchase_date)} · {catMap.get(p.category_id)?.name}{refunded > 0 && ` · estornado ${formatBRL(refunded)}`}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Money cents={p.total_cents} />
                          {refunded < p.total_cents && <Button size="sm" variant="ghost" onClick={() => setRefund(p)}><RotateCcw className="h-4 w-4" /> Estornar</Button>}
                          <Confirm title="Excluir compra?" description="Só é possível se nenhuma fatura com suas parcelas tiver pagamento." onConfirm={() => act(supabase.rpc("delete_card_purchase", { p_purchase: p.id }), "Compra excluída.")}
                            trigger={<Button size="icon" variant="ghost" aria-label={`Excluir ${p.description}`}><Trash2 className="h-4 w-4" /></Button>} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
          )}
        </>
      )}
      <CardForm open={formOpen} onOpenChange={setFormOpen} card={editing} userId={d.profile?.id ?? ""} />
      {inv && <PayForm open={payOpen} onOpenChange={setPayOpen} inv={inv} d={d} />}
      {refund && card && <RefundForm purchase={refund} card={card} d={d} onClose={() => setRefund(null)} />}
    </div>
  );
}

function CardForm({ open, onOpenChange, card, userId }: { open: boolean; onOpenChange: (o: boolean) => void; card: Card | null; userId: string }) {
  const refresh = useRefresh();
  const [name, setName] = useState(""); const [limit, setLimit] = useState(""); const [closing, setClosing] = useState("1"); const [due, setDue] = useState("10"); const [color, setColor] = useState(COLOR_CHOICES[9]);
  const [errors, setErrors] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setErrors({}); setName(card?.name ?? ""); setLimit(card ? centsToInput(card.limit_cents) : ""); setClosing(String(card?.closing_day ?? 1)); setDue(String(card?.due_day ?? 10)); setColor(card?.color ?? COLOR_CHOICES[9]); } }, [open, card]);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const er: Record<string, string> = {}; const cents = parseBRL(limit); const c = Number(closing); const dd = Number(due);
    if (!name.trim()) er.name = "Informe o nome.";
    if (!cents || cents <= 0) er.limit = "Informe um limite positivo.";
    if (!Number.isInteger(c) || c < 1 || c > 31) er.closing = "Dia entre 1 e 31.";
    if (!Number.isInteger(dd) || dd < 1 || dd > 31) er.due = "Dia entre 1 e 31.";
    if (!er.closing && !er.due && c === dd) er.due = "O vencimento deve ser diferente do fechamento.";
    setErrors(er);
    if (Object.keys(er).length || busy) return;
    setBusy(true);
    const row = { name: name.trim(), limit_cents: cents!, closing_day: c, due_day: dd, color };
    const { error } = card ? await supabase.from("cards").update(row).eq("id", card.id) : await supabase.from("cards").insert({ ...row, user_id: userId });
    setBusy(false);
    if (error) return toast.error(errMsg(error));
    toast.success(card ? "Cartão atualizado." : "Cartão criado."); refresh(); onOpenChange(false);
  }
  return (
    <FormModal open={open} onOpenChange={onOpenChange} title={card ? "Editar cartão" : "Novo cartão"} description="Se o vencimento for antes ou no dia do fechamento, ele ocorre no mês seguinte. Alterar os dias vale para novas faturas.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Nome" htmlFor="cd-name" error={errors.name}><Input id="cd-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} /></Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Limite" htmlFor="cd-limit" error={errors.limit}><MoneyInput id="cd-limit" value={limit} onChange={setLimit} /></Field>
          <Field label="Dia de fechamento" htmlFor="cd-close" error={errors.closing}><Input id="cd-close" type="number" min={1} max={31} value={closing} onChange={(e) => setClosing(e.target.value)} /></Field>
          <Field label="Dia de vencimento" htmlFor="cd-due" error={errors.due}><Input id="cd-due" type="number" min={1} max={31} value={due} onChange={(e) => setDue(e.target.value)} /></Field>
        </div>
        <ColorPicker value={color} onChange={setColor} />
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit" disabled={busy}>Salvar</Button></div>
      </form>
    </FormModal>
  );
}

function PayForm({ open, onOpenChange, inv, d }: { open: boolean; onOpenChange: (o: boolean) => void; inv: InvoiceInfo; d: FinanceData }) {
  const refresh = useRefresh();
  const accs = d.accounts.filter((a) => !a.archived);
  const [account, setAccount] = useState(""); const [amount, setAmount] = useState(""); const [date, setDate] = useState(todayBR());
  const [errors, setErrors] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(false); const [key, setKey] = useState(newKey());
  useEffect(() => { if (open) { setKey(newKey()); setErrors({}); setAccount(accs[0]?.id ?? ""); setAmount(centsToInput(inv.remaining)); setDate(todayBR()); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const cents = parseBRL(amount);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (!account) er.account = "Selecione a conta de origem.";
    if (!cents || cents <= 0) er.amount = "Informe um valor positivo.";
    else if (cents > inv.remaining) er.amount = `Máximo ${formatBRL(inv.remaining)}.`;
    if (!date) er.date = "Informe a data.";
    setErrors(er);
    if (Object.keys(er).length || busy) return;
    setBusy(true);
    const { error } = await supabase.rpc("pay_invoice", { p_invoice: inv.id, p_account: account, p_amount_cents: cents!, p_date: date, p_client_key: key });
    setBusy(false);
    if (error) return toast.error(errMsg(error));
    toast.success(cents === inv.remaining ? "Fatura paga." : "Pagamento parcial registrado."); refresh(); onOpenChange(false);
  }
  return (
    <FormModal open={open} onOpenChange={onOpenChange} title="Pagar fatura" description={`Saldo a pagar: ${formatBRL(inv.remaining)}`}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Conta de origem" htmlFor="pay-acc" error={errors.account}><NativeSelect id="pay-acc" value={account} onChange={(e) => setAccount(e.target.value)}>{accs.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</NativeSelect></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Valor" htmlFor="pay-amount" error={errors.amount} hint={cents && cents > 0 && cents <= inv.remaining ? `Restará ${formatBRL(inv.remaining - cents)}` : undefined}><MoneyInput id="pay-amount" value={amount} onChange={setAmount} /></Field>
          <Field label="Data" htmlFor="pay-date" error={errors.date}><Input id="pay-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        </div>
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit" disabled={busy}>Confirmar pagamento</Button></div>
      </form>
    </FormModal>
  );
}

function RefundForm({ purchase, card, d, onClose }: { purchase: Purchase; card: Card; d: FinanceData; onClose: () => void }) {
  const refresh = useRefresh();
  const refunded = d.purchases.filter((r) => r.refund_of === purchase.id).reduce((x, r) => x + r.total_cents, 0);
  const max = purchase.total_cents - refunded;
  const [amount, setAmount] = useState(centsToInput(max)); const [date, setDate] = useState(todayBR());
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false); const [key] = useState(newKey());
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const c = parseBRL(amount);
    if (!c || c <= 0) return setErr("Informe um valor positivo.");
    if (c > max) return setErr(`Máximo ${formatBRL(max)}.`);
    setBusy(true);
    const { error } = await supabase.rpc("refund_card_purchase", { p_purchase: purchase.id, p_amount_cents: c, p_date: date, p_closing_month: firstClosingMonth(date, card.closing_day), p_client_key: key });
    setBusy(false);
    if (error) return toast.error(errMsg(error));
    toast.success("Estorno registrado; o limite foi liberado."); refresh(); onClose();
  }
  return (
    <FormModal open onOpenChange={(o) => !o && onClose()} title={`Estornar ${purchase.description}`} description="O crédito entra na fatura do ciclo da data do estorno.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Valor do estorno" htmlFor="rf-amount" error={err}><MoneyInput id="rf-amount" value={amount} onChange={setAmount} /></Field>
          <Field label="Data" htmlFor="rf-date"><Input id="rf-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        </div>
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={busy}>Estornar</Button></div>
      </form>
    </FormModal>
  );
}
