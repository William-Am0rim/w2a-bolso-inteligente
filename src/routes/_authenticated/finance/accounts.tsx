import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Archive, ArchiveRestore, ArrowRightLeft, Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Confirm, EmptyState, Field, FormModal, Money, MoneyInput, NativeSelect, PageHeader, Pager, Panel, Tag, centsToInput, newKey, usePaged } from "@/components/app/kit";
import { WithData } from "@/components/app/WithData";
import { COLOR_CHOICES, ColorPicker } from "@/components/app/icons";
import { ACCOUNT_TYPES, errMsg, useRefresh, type Account, type FinanceData } from "@/lib/data";
import { formatDate, parseBRL, todayBR } from "@/lib/finance";
import { balances, hasMovements } from "@/lib/selectors";

const search = z.object({ novo: fallback(z.boolean(), false).default(false), arquivadas: fallback(z.boolean(), false).default(false) });

export const Route = createFileRoute("/_authenticated/finance/accounts")({
  validateSearch: zodValidator(search),
  head: () => ({ meta: [{ title: "Contas — Sr. Strix Finanças" }, { name: "description", content: "Contas bancárias, carteira e transferências." }, { property: "og:title", content: "Contas — Sr. Strix Finanças" }, { property: "og:description", content: "Contas bancárias, carteira e transferências." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: () => <WithData>{(d) => <Contas d={d} />}</WithData>,
});

function Contas({ d }: { d: FinanceData }) {
  const s = Route.useSearch();
  const navigate = useNavigate({ from: "/finance/accounts" });
  const refresh = useRefresh();
  const today = todayBR();
  const [editing, setEditing] = useState<Account | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [trOpen, setTrOpen] = useState(false);
  const bal = balances(d, today);
  const list = d.accounts.filter((a) => s.arquivadas || !a.archived).sort((a, b) => a.name.localeCompare(b.name));
  const total = d.accounts.filter((a) => !a.archived).reduce((x, a) => x + (bal.get(a.id) ?? 0), 0);
  const accName = new Map(d.accounts.map((a) => [a.id, a.name]));
  const transfers = [...d.transfers].sort((a, b) => b.transfer_date.localeCompare(a.transfer_date));
  const paged = usePaged(transfers, 10);

  useEffect(() => { if (s.novo) { setEditing(null); setFormOpen(true); navigate({ search: (p) => ({ ...p, novo: false }), replace: true }); } }, [s.novo, navigate]);

  async function act(p: PromiseLike<{ error: unknown }>, msg: string) {
    const { error } = await p;
    if (error) return toast.error(errMsg(error));
    toast.success(msg); refresh();
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Contas" description="Saldos calculados por abertura + movimentações realizadas."
        actions={<>
          <Button variant="outline" onClick={() => setTrOpen(true)} disabled={d.accounts.filter((a) => !a.archived).length < 2}><ArrowRightLeft className="h-4 w-4" /> Transferir</Button>
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="h-4 w-4" /> Nova conta</Button>
        </>} />
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><p className="text-sm text-muted-foreground">Saldo consolidado hoje</p><p className="text-3xl font-semibold"><Money cents={total} /></p></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={s.arquivadas} onChange={(e) => navigate({ search: (p) => ({ ...p, arquivadas: e.target.checked }) })} /> Mostrar arquivadas</label>
        </div>
      </Panel>
      {list.length === 0 ? (
        <Panel><EmptyState title="Nenhuma conta cadastrada" description="Cadastre sua conta corrente, poupança ou carteira." action={<Button onClick={() => { setEditing(null); setFormOpen(true); }}>Criar conta</Button>} /></Panel>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((a) => {
            const moved = hasMovements(d, a.id);
            return (
              <div key={a.id} className="rounded-xl border bg-card p-4" style={{ borderTop: `4px solid ${a.color}` }}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{a.name}</p>
                    <p className="text-sm text-muted-foreground">{ACCOUNT_TYPES[a.type]}{a.institution ? ` · ${a.institution}` : ""}</p>
                  </div>
                  {a.archived && <Tag>Arquivada</Tag>}
                </div>
                <p className="mt-3 text-2xl font-semibold"><Money cents={bal.get(a.id) ?? 0} /></p>
                <p className="text-xs text-muted-foreground">Saldo de abertura {centsToInput(a.opening_balance_cents)} em {formatDate(a.opening_date)}</p>
                <div className="mt-3 flex flex-wrap gap-1">
                  <Button size="sm" variant="ghost" onClick={() => { setEditing(a); setFormOpen(true); }}><Pencil className="h-4 w-4" /> Editar</Button>
                  <Button size="sm" variant="ghost" onClick={() => act(supabase.from("accounts").update({ archived: !a.archived }).eq("id", a.id), a.archived ? "Conta reativada." : "Conta arquivada.")}>
                    {a.archived ? <><ArchiveRestore className="h-4 w-4" /> Reativar</> : <><Archive className="h-4 w-4" /> Arquivar</>}
                  </Button>
                  {!moved && (
                    <Confirm title={`Excluir ${a.name}?`} description="A conta não possui movimentações e será removida definitivamente."
                      onConfirm={() => act(supabase.from("accounts").delete().eq("id", a.id), "Conta excluída.")}
                      trigger={<Button size="sm" variant="ghost" className="text-destructive"><Trash2 className="h-4 w-4" /> Excluir</Button>} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <Panel title="Transferências entre contas">
        {transfers.length === 0 ? <EmptyState title="Nenhuma transferência" description="Transferências alteram os saldos das duas contas e não contam como receita ou despesa." /> : (
          <>
            <ul className="divide-y">
              {paged.rows.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium">{accName.get(t.from_account_id)} → {accName.get(t.to_account_id)}</p>
                    <p className="text-muted-foreground">{formatDate(t.transfer_date)}{t.description ? ` · ${t.description}` : ""}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Money cents={t.amount_cents} />
                    <Confirm title="Excluir transferência?" description="Os saldos das duas contas serão ajustados." onConfirm={() => act(supabase.from("transfers").delete().eq("id", t.id), "Transferência excluída.")}
                      trigger={<Button size="icon" variant="ghost" aria-label="Excluir transferência"><Trash2 className="h-4 w-4" /></Button>} />
                  </div>
                </li>
              ))}
            </ul>
            <Pager page={paged.page} pages={paged.pages} setPage={paged.setPage} total={transfers.length} />
          </>
        )}
      </Panel>
      <AccountForm open={formOpen} onOpenChange={setFormOpen} account={editing} userId={d.profile?.id ?? ""} />
      <TransferForm open={trOpen} onOpenChange={setTrOpen} d={d} />
    </div>
  );
}

function AccountForm({ open, onOpenChange, account, userId }: { open: boolean; onOpenChange: (o: boolean) => void; account: Account | null; userId: string }) {
  const refresh = useRefresh();
  const [name, setName] = useState(""); const [inst, setInst] = useState(""); const [type, setType] = useState("checking");
  const [color, setColor] = useState(COLOR_CHOICES[0]); const [opening, setOpening] = useState("0,00"); const [date, setDate] = useState(todayBR());
  const [errors, setErrors] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    setErrors({});
    setName(account?.name ?? ""); setInst(account?.institution ?? ""); setType(account?.type ?? "checking");
    setColor(account?.color ?? COLOR_CHOICES[0]); setOpening(centsToInput(account?.opening_balance_cents ?? 0)); setDate(account?.opening_date ?? todayBR());
  }, [open, account]);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const er: Record<string, string> = {};
    const cents = parseBRL(opening);
    if (!name.trim()) er.name = "Informe o nome.";
    if (cents === null) er.opening = "Valor inválido.";
    if (!date) er.date = "Informe a data.";
    setErrors(er);
    if (Object.keys(er).length || busy) return;
    setBusy(true);
    const row = { name: name.trim(), institution: inst.trim() || null, type, color, opening_balance_cents: cents!, opening_date: date };
    const { error } = account ? await supabase.from("accounts").update(row).eq("id", account.id) : await supabase.from("accounts").insert({ ...row, user_id: userId });
    setBusy(false);
    if (error) return toast.error(errMsg(error));
    toast.success(account ? "Conta atualizada." : "Conta criada.");
    refresh(); onOpenChange(false);
  }
  return (
    <FormModal open={open} onOpenChange={onOpenChange} title={account ? "Editar conta" : "Nova conta"} description="O saldo de abertura é o valor imediatamente anterior às movimentações da data informada e não conta como receita.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Nome" htmlFor="acc-name" error={errors.name}><Input id="acc-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Instituição (opcional)" htmlFor="acc-inst"><Input id="acc-inst" value={inst} onChange={(e) => setInst(e.target.value)} maxLength={60} /></Field>
          <Field label="Tipo" htmlFor="acc-type"><NativeSelect id="acc-type" value={type} onChange={(e) => setType(e.target.value)}>{Object.entries(ACCOUNT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</NativeSelect></Field>
          <Field label="Saldo de abertura" htmlFor="acc-open" error={errors.opening}><MoneyInput id="acc-open" value={opening} onChange={setOpening} /></Field>
          <Field label="Data do saldo" htmlFor="acc-date" error={errors.date}><Input id="acc-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        </div>
        <ColorPicker value={color} onChange={setColor} />
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit" disabled={busy}>Salvar</Button></div>
      </form>
    </FormModal>
  );
}

function TransferForm({ open, onOpenChange, d }: { open: boolean; onOpenChange: (o: boolean) => void; d: FinanceData }) {
  const refresh = useRefresh();
  const accs = d.accounts.filter((a) => !a.archived);
  const [fromA, setFrom] = useState(""); const [toA, setTo] = useState(""); const [amount, setAmount] = useState(""); const [date, setDate] = useState(todayBR()); const [desc, setDesc] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(false); const [key, setKey] = useState(newKey());
  useEffect(() => { if (open) { setKey(newKey()); setErrors({}); setFrom(accs[0]?.id ?? ""); setTo(accs[1]?.id ?? ""); setAmount(""); setDate(todayBR()); setDesc(""); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const er: Record<string, string> = {};
    const cents = parseBRL(amount);
    if (!fromA) er.from = "Selecione a origem.";
    if (!toA) er.to = "Selecione o destino.";
    if (fromA && fromA === toA) er.to = "Origem e destino devem ser diferentes.";
    if (!cents || cents <= 0) er.amount = "Informe um valor positivo.";
    if (!date) er.date = "Informe a data.";
    setErrors(er);
    if (Object.keys(er).length || busy) return;
    setBusy(true);
    const { error } = await supabase.from("transfers").insert({ user_id: d.profile!.id, from_account_id: fromA, to_account_id: toA, amount_cents: cents!, transfer_date: date, description: desc.trim() || null, client_key: key });
    setBusy(false);
    if (error && !String(error.message).includes("client_key")) return toast.error(errMsg(error));
    toast.success("Transferência registrada."); refresh(); onOpenChange(false);
  }
  return (
    <FormModal open={open} onOpenChange={onOpenChange} title="Transferir entre contas" description="Não conta como receita nem despesa.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Origem" htmlFor="tr-from" error={errors.from}><NativeSelect id="tr-from" value={fromA} onChange={(e) => setFrom(e.target.value)}>{accs.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</NativeSelect></Field>
          <Field label="Destino" htmlFor="tr-to" error={errors.to}><NativeSelect id="tr-to" value={toA} onChange={(e) => setTo(e.target.value)}>{accs.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</NativeSelect></Field>
          <Field label="Valor" htmlFor="tr-amount" error={errors.amount}><MoneyInput id="tr-amount" value={amount} onChange={setAmount} /></Field>
          <Field label="Data" htmlFor="tr-date" error={errors.date}><Input id="tr-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        </div>
        <Field label="Descrição (opcional)" htmlFor="tr-desc"><Input id="tr-desc" value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={100} /></Field>
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit" disabled={busy}>Transferir</Button></div>
      </form>
    </FormModal>
  );
}
