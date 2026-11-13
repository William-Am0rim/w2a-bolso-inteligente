import { createFileRoute, redirect } from "@tanstack/react-router";

// Legacy URL: kept so old bookmarks open the module route.
export const Route = createFileRoute("/_authenticated/orcamentos")({
  beforeLoad: ({ search }) => { throw redirect({ to: "/finance/budgets", search: search as never, replace: true }); },
});
