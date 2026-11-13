import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/finance/")({
  beforeLoad: () => { throw redirect({ to: "/finance/dashboard", search: {} as never, replace: true }); },
});
