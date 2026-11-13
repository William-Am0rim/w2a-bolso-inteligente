import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Field, NativeSelect, PageHeader, Panel } from "@/components/app/kit";
import { WithData } from "@/components/app/WithData";
import { errMsg, useRefresh, type FinanceData } from "@/lib/data";
import { useTheme } from "@/lib/prefs";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — Sr. Strix Finanças" }, { name: "description", content: "Perfil e preferências." }, { property: "og:title", content: "Configurações — Sr. Strix Finanças" }, { property: "og:description", content: "Perfil e preferências." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: () => <WithData>{(d) => <Config d={d} />}</WithData>,
});

function Config({ d }: { d: FinanceData }) {
  const refresh = useRefresh();
  const { theme, setTheme } = useTheme();
  const [name, setName] = useState(d.profile?.display_name ?? "");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? "")); }, []);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setErr("Informe seu nome.");
    setErr(""); setBusy(true);
    const { error } = await supabase.from("profiles").update({ display_name: name.trim() }).eq("id", d.profile!.id);
    setBusy(false);
    if (error) return toast.error(errMsg(error));
    toast.success("Perfil atualizado."); refresh();
  }
  return (
    <div className="max-w-2xl space-y-4">
      <PageHeader title="Configurações" />
      <Panel title="Perfil">
        <form onSubmit={save} className="space-y-4" noValidate>
          <Field label="Nome" htmlFor="cfg-name" error={err}><Input id="cfg-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} /></Field>
          <Field label="E-mail" htmlFor="cfg-email"><Input id="cfg-email" value={email} disabled /></Field>
          <Button type="submit" disabled={busy}>Salvar</Button>
        </form>
      </Panel>
      <Panel title="Aparência">
        <div className="flex items-center justify-between gap-4">
          <div><p className="font-medium">Tema escuro</p><p className="text-sm text-muted-foreground">Preferência salva neste dispositivo.</p></div>
          <Switch checked={theme === "dark"} onCheckedChange={(v) => setTheme(v ? "dark" : "light")} aria-label="Tema escuro" />
        </div>
      </Panel>
      <Panel title="Visualização">
        <Field label="Formato" htmlFor="cfg-fmt" hint="Moeda BRL, datas DD/MM/AAAA e fuso America/Sao_Paulo.">
          <NativeSelect id="cfg-fmt" disabled value="br"><option value="br">Português (Brasil) — R$ 1.234,56</option></NativeSelect>
        </Field>
      </Panel>
    </div>
  );
}
