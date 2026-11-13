import { createFileRoute, redirect } from "@tanstack/react-router";

// Legacy URL: kept so old bookmarks open the module route.
export const Route = createFileRoute("/_authenticated/contas")({
  beforeLoad: ({ search }) => { throw redirect({ to: "/finance/accounts", search: search as never, replace: true }); },
});
