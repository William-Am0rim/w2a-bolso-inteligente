import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app/AppShell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth", search: { redirect: location.href } });
    if (!location.pathname.startsWith("/portal")) {
      const { data: ok } = await supabase.rpc("has_system_access", { p_slug: "financas" });
      if (!ok) throw redirect({ to: "/portal" });
    }
    return { user: data.user };
  },
  component: Layout,
});

function Layout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return path.startsWith("/portal") ? <Outlet /> : <AppShell />;
}
