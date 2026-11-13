import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PortalSystem = { id: string; slug: string; name: string; description: string; path: string; granted: boolean };

export const portalQuery = queryOptions({
  queryKey: ["portal"],
  staleTime: 60_000,
  queryFn: async () => {
    const { data: s } = await supabase.auth.getSession();
    const user = s.session?.user;
    const uid = user?.id ?? "";
    const [sys, role] = await Promise.all([
      supabase.from("portal_systems").select("id,slug,name,description,path").eq("active", true).order("sort_order"),
      supabase.from("user_roles").select("role").eq("user_id", uid).eq("role", "admin").maybeSingle(),
    ]);
    if (sys.error) throw sys.error;
    // RLS returns only systems this person may use (or all, for admins).
    const systems: PortalSystem[] = (sys.data ?? []).map((x) => ({ ...x, granted: true }));
    const name = (user?.user_metadata?.display_name as string | undefined) ?? user?.email?.split("@")[0] ?? "";
    return { systems, isAdmin: !!role.data, email: user?.email, name };
  },
});
