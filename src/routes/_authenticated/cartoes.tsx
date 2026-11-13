import { createFileRoute, redirect } from "@tanstack/react-router";

// Legacy URL: kept so old bookmarks open the module route.
export const Route = createFileRoute("/_authenticated/cartoes")({
  beforeLoad: ({ search }) => { throw redirect({ to: "/finance/cards", search: search as never, replace: true }); },
});
