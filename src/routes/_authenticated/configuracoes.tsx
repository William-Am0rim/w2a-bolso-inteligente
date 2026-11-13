import { createFileRoute, redirect } from "@tanstack/react-router";

// Legacy URL: kept so old bookmarks open the module route.
export const Route = createFileRoute("/_authenticated/configuracoes")({
  beforeLoad: ({ search }) => { throw redirect({ to: "/finance/settings", search: search as never, replace: true }); },
});
