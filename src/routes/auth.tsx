import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useState } from "react";
import { toast } from "sonner";
import { Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const search = z.object({ redirect: fallback(z.string(), "").default("") });

export const Route = createFileRoute("/auth")({
  validateSearch: zodValidator(search),
  head: () => ({
    meta: [
      { title: "Entrar — W2A Finanças" },
      { name: "description", content: "Acesse ou crie sua conta no W2A Finanças." },
      { property: "og:title", content: "Entrar — W2A Finanças" },
      { property: "og:description", content: "Acesse ou crie sua conta no W2A Finanças." },
    ],
  }),
  component: AuthPage,
});

function safePath(p: string) {
  try {
    const u = new URL(p, window.location.origin);
    if (u.origin !== window.location.origin || u.pathname.startsWith("/auth")) return "/dashboard";
    return u.pathname + u.search;
  } catch {
    return "/dashboard";
  }
}

function AuthPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

  function validate() {
    const e: Record<string, string> = {};
    if (!/^\S+@\S+\.\S+$/.test(email)) e.email = "Informe um e-mail válido.";
    if (mode !== "forgot" && password.length < 6) e.password = "A senha precisa ter pelo menos 6 caracteres.";
    if (mode === "signup" && !name.trim()) e.name = "Informe seu nome.";
    setErrors(e);
    return !Object.keys(e).length;
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate() || busy) return;
    setBusy(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Bem-vindo de volta!");
        navigate({ to: safePath(redirect || "/dashboard") as "/dashboard" });
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/dashboard", data: { display_name: name.trim() } },
        });
        if (error) throw error;
        if (data.session) navigate({ to: "/dashboard" });
        else setSent("Enviamos um link de confirmação para o seu e-mail. Confirme para entrar.");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setSent("Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha.");
      }
    } catch (e) {
      const msg = (e as Error).message;
      toast.error(msg === "Invalid login credentials" ? "E-mail ou senha incorretos." : msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Wallet className="h-6 w-6" aria-hidden />
          </div>
          <div>
            <h1 className="text-xl font-semibold">W2A Finanças</h1>
            <p className="text-sm text-muted-foreground">Suas finanças organizadas, todos os dias.</p>
          </div>
        </div>
        {sent ? (
          <div className="space-y-4">
            <p className="rounded-lg bg-success-soft p-4 text-sm" role="status">{sent}</p>
            <Button variant="outline" className="w-full" onClick={() => { setSent(null); setMode("login"); }}>
              Voltar para o login
            </Button>
          </div>
        ) : (
          <>
            {mode !== "forgot" && (
              <Tabs value={mode} onValueChange={(v) => { setMode(v as "login"); setErrors({}); }} className="mb-4">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="login">Entrar</TabsTrigger>
                  <TabsTrigger value="signup">Criar conta</TabsTrigger>
                </TabsList>
                <TabsContent value="login" />
                <TabsContent value="signup" />
              </Tabs>
            )}
            {mode === "forgot" && <h2 className="mb-4 font-semibold">Recuperar senha</h2>}
            <form onSubmit={submit} className="space-y-4" noValidate>
              {mode === "signup" && (
                <div className="space-y-1.5">
                  <Label htmlFor="name">Nome</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!errors.name} autoComplete="name" />
                  {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!errors.email} autoComplete="email" />
                {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
              </div>
              {mode !== "forgot" && (
                <div className="space-y-1.5">
                  <Label htmlFor="password">Senha</Label>
                  <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={!!errors.password} autoComplete={mode === "login" ? "current-password" : "new-password"} />
                  {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
                </div>
              )}
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Aguarde..." : mode === "login" ? "Entrar" : mode === "signup" ? "Criar conta" : "Enviar link"}
              </Button>
            </form>
            <div className="mt-4 text-center text-sm">
              {mode === "forgot" ? (
                <button className="text-primary underline-offset-4 hover:underline" onClick={() => setMode("login")}>Voltar para o login</button>
              ) : (
                <button className="text-primary underline-offset-4 hover:underline" onClick={() => setMode("forgot")}>Esqueci minha senha</button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
