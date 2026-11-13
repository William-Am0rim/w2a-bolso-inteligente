import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ArrowUpRight, Lock, Wallet } from "lucide-react";
import { ParticleField } from "@/components/portal/ParticleField";
import { PortalHeader } from "@/components/portal/PortalHeader";
import { portalQuery, type PortalSystem } from "@/lib/portal";

export const Route = createFileRoute("/_authenticated/portal/")({
  head: () => ({ meta: [
    { title: "Portal Sr. Strix — Seus sistemas" },
    { name: "description", content: "Acesse todos os sistemas Sr. Strix liberados para você." },
    { property: "og:title", content: "Portal Sr. Strix — Seus sistemas" },
    { property: "og:description", content: "Acesse todos os sistemas Sr. Strix liberados para você." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(portalQuery),
  component: Portal,
});

const ICONS: Record<string, typeof Wallet> = { financas: Wallet };

function Portal() {
  const { data } = useSuspenseQuery(portalQuery);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const ctx = gsap.context(() => {
        gsap.from(".p-reveal", { y: 24, opacity: 0, duration: 0.9, stagger: 0.08, ease: "power3.out" });
        gsap.from(".p-card", { y: 40, opacity: 0, scale: 0.97, duration: 1, stagger: 0.1, delay: 0.25, ease: "power4.out" });
      }, root);
      return () => ctx.revert();
    });
    return () => mm.revert();
  }, []);

  const hour = new Date().getHours();
  const greet = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  return (
    <div ref={root} className="relative min-h-screen overflow-hidden bg-portal-bg text-portal-fg">
      <ParticleField className="pointer-events-none fixed inset-0" />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgb(139_92_246/0.18),transparent_60%)]" />
      <PortalHeader email={data.email} isAdmin={data.isAdmin} />
      <main className="relative z-10 mx-auto w-full max-w-6xl px-5 pb-20 pt-10 sm:px-8 sm:pt-20">
        <p className="p-reveal text-xs uppercase tracking-[0.3em] text-portal-accent">Portal Sr. Strix</p>
        <h1 className="p-reveal mt-3 text-3xl font-light tracking-tight sm:text-5xl">
          {greet}, <span className="font-semibold">{data.name}</span>.
        </h1>
        <p className="p-reveal mt-3 max-w-md text-sm text-portal-muted">Escolha um sistema para começar.</p>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {data.systems.map((s) => <SystemCard key={s.id} s={s} />)}
          {data.systems.length === 0 && <p className="text-sm text-portal-muted">Seu acesso está aguardando liberação do administrador.</p>}
        </div>
      </main>
    </div>
  );
}

function SystemCard({ s }: { s: PortalSystem }) {
  const ref = useRef<HTMLDivElement>(null);
  const Icon = ICONS[s.slug] ?? Wallet;

  function onMove(e: React.PointerEvent) {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty("--mx", `${(x + 0.5) * 100}%`);
    el.style.setProperty("--my", `${(y + 0.5) * 100}%`);
    gsap.to(el, { rotateY: x * 10, rotateX: -y * 10, duration: 0.5, ease: "power2.out", transformPerspective: 900 });
  }
  function onLeave() {
    if (ref.current) gsap.to(ref.current, { rotateX: 0, rotateY: 0, duration: 0.8, ease: "elastic.out(1, 0.5)" });
  }

  const body = (
    <div ref={ref} onPointerMove={onMove} onPointerLeave={onLeave}
      className="p-card group relative h-full overflow-hidden rounded-2xl border border-portal-line bg-portal-card p-6 backdrop-blur-md transition-colors hover:border-portal-accent/60"
      style={{ transformStyle: "preserve-3d" }}>
      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: "radial-gradient(400px circle at var(--mx,50%) var(--my,50%), rgb(139 92 246 / 0.22), transparent 45%)" }} />
      <div className="relative flex items-start justify-between">
        <div className="grid h-12 w-12 place-items-center rounded-xl border border-portal-line bg-portal-accent/10 text-portal-accent">
          <Icon className="h-5 w-5" aria-hidden />
        </div>
        {s.granted
          ? <ArrowUpRight className="h-5 w-5 text-portal-muted transition-transform duration-300 group-hover:-translate-y-1 group-hover:translate-x-1 group-hover:text-portal-fg" aria-hidden />
          : <span className="inline-flex items-center gap-1 rounded-full border border-portal-line px-2.5 py-1 text-[11px] text-portal-muted"><Lock className="h-3 w-3" aria-hidden /> Aguardando liberação</span>}
      </div>
      <h2 className="relative mt-10 text-xl font-semibold">{s.name}</h2>
      <p className="relative mt-1.5 text-sm leading-relaxed text-portal-muted">{s.description}</p>
      <p className="relative mt-6 text-xs text-portal-muted">
        {s.granted ? <span className="text-portal-fg">Entrar no sistema →</span> : "Peça ao administrador para liberar seu acesso."}
      </p>
    </div>
  );

  return s.granted
    ? <Link to={s.path as "/dashboard"} preload="intent" className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-accent" aria-label={`Abrir ${s.name}`}>{body}</Link>
    : <div aria-disabled className="cursor-not-allowed opacity-80">{body}</div>;
}
