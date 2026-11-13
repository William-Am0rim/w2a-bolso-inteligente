import { redirect } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Guard for a portal module layout: redirects to the portal when the user lacks access to `slug`. */
export async function requireModuleAccess(queryClient: QueryClient, userId: string, slug: string) {
  const ok = await queryClient.ensureQueryData({
    queryKey: ["system-access", userId, slug],
    queryFn: async () => (await supabase.rpc("has_system_access", { p_slug: slug })).data ?? false,
    staleTime: 60_000,
  });
  if (!ok) throw redirect({ to: "/portal" });
}
