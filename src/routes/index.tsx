import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowRight, CreditCard, PieChart, Target, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "W2A Finanças — finanças pessoais organizadas" },
      { name: "description", content: "Controle receitas, despesas, contas, cartões, orçamentos e metas em um só lugar." },
      { property: "og:title", content: "W2A Finanças — finanças pessoais organizadas" },
      { property: "og:description", content: "Controle receitas, despesas, contas, cartões, orçamentos e metas em um só lugar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { if (data.session) navigate({ to: "/dashboard", replace: true }); });
  }, [navigate]);
  const feats = [
    { icon: Wallet, t: "Contas e saldos", d: "Saldo por conta e consolidado, sempre atualizado." },
    { icon: CreditCard, t: "Cartões e faturas", d: "Parcelas exatas, ciclo de fechamento e limite disponível." },
    { icon: PieChart, t: "Orçamentos", d: "Limites por categoria com alertas em 80% e 100%." },
    { icon: Target, t: "Metas", d: "Acompanhe aportes e o progresso dos seus objetivos." },
  ];
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between p-4 sm:p-6">
        <div className="flex items-center gap-2 font-semibold"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Wallet className="h-5 w-5" aria-hidden /></span>W2A Finanças</div>
        <Button asChild variant="outline"><Link to="/auth" search={{ redirect: "" }}>Entrar</Link></Button>
      </header>
      <main className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <section className="py-12 sm:py-20">
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">Seu dinheiro, organizado com clareza.</h1>
          <p className="mt-4 max-w-2xl text-lg text-muted-foreground">Receitas, despesas, contas, cartões, orçamentos e metas — com cálculos exatos, em reais, no seu computador e no celular.</p>
          <Button asChild size="lg" className="mt-8"><Link to="/auth" search={{ redirect: "" }}>Começar agora <ArrowRight className="h-4 w-4" aria-hidden /></Link></Button>
        </section>
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {feats.map((f) => (
            <div key={f.t} className="rounded-xl border bg-card p-5">
              <f.icon className="h-6 w-6 text-primary" aria-hidden />
              <h2 className="mt-3 font-semibold">{f.t}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{f.d}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
