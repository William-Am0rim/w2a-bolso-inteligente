import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { toast } from "sonner";
import { ArrowRight, ArrowUpRight, CheckCircle2, Eye, EyeOff, Loader2, LockKeyhole, Mail, ShieldCheck, UserRound } from "lucide-react";
import logoAsset from "@/assets/sr-strix-logo.png.asset.json";
import owlAsset from "@/assets/sr-strix-owl.png.asset.json";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const search = z.object({ redirect: fallback(z.string(), "").default("") });

export const Route = createFileRoute("/auth")({
  validateSearch: zodValidator(search),
  head: () => ({
    meta: [
      { title: "Entrar ou criar conta — Sr. Strix Finanças" },
      { name: "description", content: "Acesse ou crie sua conta no Sr. Strix Finanças." },
      { property: "og:title", content: "Entrar ou criar conta — Sr. Strix Finanças" },
      { property: "og:description", content: "Acesse ou crie sua conta no Sr. Strix Finanças." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function safePath(p: string) {
  try {
    const u = new URL(p, window.location.origin);
    if (u.origin !== window.location.origin || u.pathname.startsWith("/auth")) return "/portal";
    return u.pathname + u.search;
  } catch {
    return "/portal";
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
  const [showPassword, setShowPassword] = useState(false);
  const pageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      const ctx = gsap.context(() => {
        gsap.from(".auth-reveal", { y: 22, opacity: 0, duration: 0.8, stagger: 0.1, ease: "power3.out" });
        gsap.to(".strix-orbit", { rotation: 360, duration: 100, repeat: -1, ease: "none" });
        gsap.to(".strix-owl", { y: -10, duration: 3, repeat: -1, yoyo: true, ease: "sine.inOut" });
      }, pageRef);
      return () => ctx.revert();
    });
    return () => media.revert();
  }, []);

  function changeMode(next: "login" | "signup" | "forgot") {
    setMode(next); setErrors({}); setSent(null); setShowPassword(false);
  }

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
        navigate({ to: safePath(redirect || "/portal") as "/portal" });
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/portal", data: { display_name: name.trim() } },
        });
        if (error) throw error;
        if (data.session) navigate({ to: "/portal" });
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
    <div ref={pageRef} className="strix-auth">
      <section className="auth-art" aria-label="Sr. Strix Finanças">
        <div className="auth-art-top auth-reveal"><span>SR. STRIX / FINANÇAS</span><ArrowUpRight size={18} aria-hidden /></div>
        <div className="auth-brand-scene">
          <div className="strix-orbit" aria-hidden><span /><span /><span /></div>
          <img src={owlAsset.url} alt="" className="strix-owl" />
        </div>
        <div className="auth-art-copy auth-reveal">
          <span className="auth-eyebrow">UM NOVO OLHAR PARA O SEU DINHEIRO</span>
          <h2>Mais clareza.<br />Mais <span>possibilidades.</span></h2>
          <p>Equilíbrio hoje. Liberdade para o amanhã.</p>
        </div>
        <div className="auth-art-bottom auth-reveal"><span>Seu próximo capítulo começa aqui.</span><span>01 — 03</span></div>
      </section>
      <main className="auth-main">
        <header className="auth-main-header auth-reveal"><img src={logoAsset.url} alt="Sr. Strix Finanças" /><span><ShieldCheck size={14} aria-hidden /> ACESSO SEGURO</span></header>
        <div className="auth-form-wrap auth-reveal">
          <span className="auth-eyebrow">SUAS FINANÇAS. SEU FUTURO.</span>
          <h1>{sent ? "Confira seu e-mail" : mode === "login" ? "Bom ter você de volta." : mode === "signup" ? "Seu futuro começa agora." : "Vamos recuperar seu acesso."}</h1>
          <p className="auth-intro">{sent ? "Falta só mais um passo para continuar." : mode === "login" ? "Entre na sua conta e siga em frente." : mode === "signup" ? "Crie sua conta e dê o primeiro passo." : "Informe o e-mail associado à sua conta."}</p>
        {sent ? (
          <div className="space-y-4">
            <p className="auth-sent" role="status"><CheckCircle2 size={22} aria-hidden />{sent}</p>
            <Button variant="outline" className="w-full auth-secondary" onClick={() => changeMode("login")}>
              Voltar para o login
            </Button>
          </div>
        ) : (
          <>
            <form onSubmit={submit} className="space-y-5" noValidate>
              {mode === "signup" && (
                <div className="space-y-1.5">
                  <Label htmlFor="name">Nome</Label>
                  <div className="auth-input-wrap"><UserRound size={18} aria-hidden /><Input id="name" placeholder="Como podemos chamar você?" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!errors.name} aria-describedby={errors.name ? "name-error" : undefined} autoComplete="name" disabled={busy} /></div>
                  {errors.name && <p id="name-error" className="text-sm text-destructive">{errors.name}</p>}
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="email">E-mail</Label>
                <div className="auth-input-wrap"><Mail size={18} aria-hidden /><Input id="email" type="email" placeholder="voce@exemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!errors.email} aria-describedby={errors.email ? "email-error" : undefined} autoComplete="email" disabled={busy} /></div>
                {errors.email && <p id="email-error" className="text-sm text-destructive">{errors.email}</p>}
              </div>
              {mode !== "forgot" && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2"><Label htmlFor="password">Senha</Label>{mode === "login" && <Button type="button" variant="link" className="auth-link h-auto p-0 text-xs" onClick={() => changeMode("forgot")} disabled={busy}>Esqueceu a senha?</Button>}</div>
                  <div className="auth-input-wrap"><LockKeyhole size={18} aria-hidden /><Input id="password" type={showPassword ? "text" : "password"} placeholder={mode === "signup" ? "Pelo menos 6 caracteres" : "Sua senha"} value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={!!errors.password} aria-describedby={errors.password ? "password-error" : undefined} autoComplete={mode === "login" ? "current-password" : "new-password"} disabled={busy} /><Button type="button" variant="ghost" size="icon" className="auth-eye" aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} title={showPassword ? "Ocultar senha" : "Mostrar senha"} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</Button></div>
                  {errors.password && <p id="password-error" className="text-sm text-destructive">{errors.password}</p>}
                </div>
              )}
              <Button type="submit" className="auth-submit w-full" disabled={busy}>
                {busy ? "Aguarde..." : mode === "login" ? "Entrar" : mode === "signup" ? "Criar conta" : "Enviar link"}
                {busy ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <ArrowRight size={18} aria-hidden />}
              </Button>
            </form>
            <div className="auth-switch">
              {mode === "forgot" ? (
                <Button variant="link" className="auth-link" onClick={() => changeMode("login")} disabled={busy}>Voltar para o login</Button>
              ) : (
<span>Seu acesso é criado pelo administrador do portal.</span>
              )}
            </div>
          </>
        )}
      </div>
      <footer className="auth-main-footer"><span>© {new Date().getFullYear()} Sr. Strix</span><span><LockKeyhole size={12} aria-hidden /> Seu espaço financeiro pessoal</span></footer>
      </main>
    </div>
  );
}
