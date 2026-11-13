import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app/AppShell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location, context }) => {
    // Local session read: no network round-trip on every navigation (server still validates via RLS).
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    if (!user) throw redirect({ to: "/auth", search: { redirect: location.href } });
    if (!location.pathname.startsWith("/portal")) {
      const ok = await context.queryClient.ensureQueryData({
        queryKey: ["system-access", user.id, "financas"],
        queryFn: async () => (await supabase.rpc("has_system_access", { p_slug: "financas" })).data ?? false,
        staleTime: 60_000,
      });
      if (!ok) throw redirect({ to: "/portal" });
    }
    return { user };
  },
  component: Layout,
});

function Layout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return path.startsWith("/portal") ? <Outlet /> : <AppShell />;
}
