import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => { throw redirect({ to: "/auth", search: { redirect: "" }, replace: true }); },
  head: () => ({ meta: [
    { title: "Sr. Strix Finanças — Acesse sua conta" },
    { name: "description", content: "Entre no Sr. Strix Finanças para cuidar do seu dinheiro." },
    { property: "og:title", content: "Sr. Strix Finanças — Acesse sua conta" },
    { property: "og:description", content: "Entre no Sr. Strix Finanças para cuidar do seu dinheiro." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
});