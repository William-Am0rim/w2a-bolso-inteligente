import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Minus, Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Confirm, EmptyState, Field, FormModal, Money, MoneyInput, PageHeader, Panel, ProgressBar, centsToInput, newKey } from "@/components/app/kit";
import { WithData } from "@/components/app/WithData";
import { errMsg, useRefresh, type FinanceData, type Goal } from "@/lib/data";
import { formatDate, parseBRL, pct, todayBR } from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/finance/goals")({
  head: () => ({ meta: [{ title: "Metas — Sr. Strix Finanças" }, { name: "description", content: "Acompanhe seus objetivos financeiros." }, { property: "og:title", content: "Metas — Sr. Strix Finanças" }, { property: "og:description", content: "Acompanhe seus objetivos financeiros." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: () => <WithData>{(d) => <Metas d={d} />}</WithData>,
});

function saved(d: FinanceData, id: string) {
  return d.goalEntries.filter((e) => e.goal_id === id).reduce((s, e) => s + (e.kind === "deposit" ? e.amount_cents : -e.amount_cents), 0);
}

function Metas({ d }: { d: FinanceData }) {
  const refresh = useRefresh();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [entry, setEntry] = useState<{ goal: Goal; kind: "deposit" | "withdraw" } | null>(null);
  return (
    <div>
      <PageHeader title="Metas" description="Acompanhamento manual de valores reservados. Não altera saldos bancários nem gera despesas."
        actions={<Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="h-4 w-4" /> Nova meta</Button>} />
      {d.goals.length === 0 ? (
        <Panel><EmptyState title="Nenhuma meta" description="Crie uma meta como reserva de emergência ou viagem." action={<Button onClick={() => setOpen(true)}>Criar meta</Button>} /></Panel>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {d.goals.map((g) => {
            const sv = saved(d, g.id);
            const p = pct(sv, g.target_cents) ?? 0;
            const hist = d.goalEntries.filter((e) => e.goal_id === g.id).sort((a, b) => b.entry_date.localeCompare(a.entry_date));
            return (
              <Panel key={g.id}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="flex items-center gap-1 font-semibold">{p >= 100 && <CheckCircle2 className="h-4 w-4 text-success" aria-label="Concluída" />}{g.name}</p>
                    <p className="text-sm text-muted-foreground">{g.deadline ? `Prazo ${formatDate(g.deadline)}` : "Sem prazo"}{g.description ? ` · ${g.description}` : ""}</p>
                  </div>
                  <div className="flex">
                    <Button size="icon" variant="ghost" aria-label={`Editar ${g.name}`} onClick={() => { setEditing(g); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                    <Confirm title={`Excluir ${g.name}?`} description="O histórico de aportes também será removido." onConfirm={async () => { const { error } = await supabase.from("goals").delete().eq("id", g.id); if (error) toast.error(errMsg(error)); else { toast.success("Meta excluída."); refresh(); } }}
                      trigger={<Button size="icon" variant="ghost" className="text-destructive" aria-label={`Excluir ${g.name}`}><Trash2 className="h-4 w-4" /></Button>} />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline justify-between text-sm"><span><Money cents={sv} className="text-lg font-semibold" /> de <Money cents={g.target_cents} /></span><span className="tabular">{p.toFixed(0)}%</span></div>
                <div className="mt-2"><ProgressBar value={p} tone={p >= 100 ? "success" : "primary"} label={g.name} /></div>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" onClick={() => setEntry({ goal: g, kind: "deposit" })}><Plus className="h-4 w-4" /> Aporte</Button>
                  <Button size="sm" variant="outline" onClick={() => setEntry({ goal: g, kind: "withdraw" })} disabled={sv <= 0}><Minus className="h-4 w-4" /> Retirada</Button>
                </div>
                {hist.length > 0 && (
                  <ul className="mt-3 max-h-40 divide-y overflow-y-auto border-t text-sm">
                    {hist.map((e) => (
                      <li key={e.id} className="flex items-center justify-between gap-2 py-1.5">
                        <span>{formatDate(e.entry_date)} · {e.kind === "deposit" ? "Aporte" : "Retirada"}{e.note ? ` · ${e.note}` : ""}</span>
                        <span className="flex items-center gap-1"><Money cents={e.kind === "deposit" ? e.amount_cents : -e.amount_cents} signed tone="auto" />
                          <Confirm title="Excluir registro?" onConfirm={async () => { const { error } = await supabase.from("goal_entries").delete().eq("id", e.id); if (error) toast.error(errMsg(error)); else refresh(); }}
                            trigger={<Button size="icon" variant="ghost" aria-label="Excluir registro"><Trash2 className="h-3.5 w-3.5" /></Button>} />
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            );
          })}
        </div>
      )}
      <GoalForm open={open} onOpenChange={setOpen} goal={editing} userId={d.profile?.id ?? ""} />
      {entry && <EntryForm {...entry} max={entry.kind === "withdraw" ? saved(d, entry.goal.id) : undefined} onClose={() => setEntry(null)} />}
    </div>
  );
}

function GoalForm({ open, onOpenChange, goal, userId }: { open: boolean; onOpenChange: (o: boolean) => void; goal: Goal | null; userId: string }) {
  const refresh = useRefresh();
  const [name, setName] = useState(""); const [target, setTarget] = useState(""); const [deadline, setDeadline] = useState(""); const [desc, setDesc] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setErrors({}); setName(goal?.name ?? ""); setTarget(goal ? centsToInput(goal.target_cents) : ""); setDeadline(goal?.deadline ?? ""); setDesc(goal?.description ?? ""); } }, [open, goal]);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const er: Record<string, string> = {}; const c = parseBRL(target);
    if (!name.trim()) er.name = "Informe o nome.";
    if (!c || c <= 0) er.target = "Informe um valor positivo.";
    setErrors(er);
    if (Object.keys(er).length || busy) return;
    setBusy(true);
    const row = { name: name.trim(), target_cents: c!, deadline: deadline || null, description: desc.trim() || null };
    const { error } = goal ? await supabase.from("goals").update(row).eq("id", goal.id) : await supabase.from("goals").insert({ ...row, user_id: userId });
    setBusy(false);
    if (error) return toast.error(errMsg(error));
    toast.success("Meta salva."); refresh(); onOpenChange(false);
  }
  return (
    <FormModal open={open} onOpenChange={onOpenChange} title={goal ? "Editar meta" : "Nova meta"}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Nome" htmlFor="gl-name" error={errors.name}><Input id="gl-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Valor desejado" htmlFor="gl-target" error={errors.target}><MoneyInput id="gl-target" value={target} onChange={setTarget} /></Field>
          <Field label="Prazo (opcional)" htmlFor="gl-deadline"><Input id="gl-deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></Field>
        </div>
        <Field label="Descrição" htmlFor="gl-desc"><Textarea id="gl-desc" value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} maxLength={300} /></Field>
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit" disabled={busy}>Salvar</Button></div>
      </form>
    </FormModal>
  );
}

function EntryForm({ goal, kind, max, onClose }: { goal: Goal; kind: "deposit" | "withdraw"; max?: number; onClose: () => void }) {
  const refresh = useRefresh();
  const [amount, setAmount] = useState(""); const [date, setDate] = useState(todayBR()); const [note, setNote] = useState("");
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false); const [key] = useState(newKey());
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const c = parseBRL(amount);
    if (!c || c <= 0) return setErr("Informe um valor positivo.");
    if (max !== undefined && c > max) return setErr("Retirada maior que o valor reservado.");
    setBusy(true);
    const { error } = await supabase.from("goal_entries").insert({ user_id: goal.user_id, goal_id: goal.id, kind, amount_cents: c, entry_date: date, note: note.trim() || null, client_key: key });
    setBusy(false);
    if (error && !String(error.message).includes("client_key")) return toast.error(errMsg(error));
    toast.success(kind === "deposit" ? "Aporte registrado." : "Retirada registrada."); refresh(); onClose();
  }
  return (
    <FormModal open onOpenChange={(o) => !o && onClose()} title={`${kind === "deposit" ? "Aporte" : "Retirada"} — ${goal.name}`}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Valor" htmlFor="ge-amount" error={err}><MoneyInput id="ge-amount" value={amount} onChange={setAmount} /></Field>
          <Field label="Data" htmlFor="ge-date"><Input id="ge-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        </div>
        <Field label="Observação" htmlFor="ge-note"><Input id="ge-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={100} /></Field>
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={busy}>Salvar</Button></div>
      </form>
    </FormModal>
  );
}
