import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app/AppShell";
import { requireModuleAccess } from "@/lib/module-access";

// Finance module: every page lives under /finance/* and shares this access guard and shell.
export const Route = createFileRoute("/_authenticated/finance")({
  beforeLoad: ({ context }) => requireModuleAccess(context.queryClient, context.user.id, "financas"),
  component: AppShell,
});
