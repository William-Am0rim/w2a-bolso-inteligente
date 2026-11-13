import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PortalSystem = { id: string; slug: string; name: string; description: string; path: string; granted: boolean };

export const portalQuery = queryOptions({
  queryKey: ["portal"],
  queryFn: async () => {
    const { data: u } = await supabase.auth.getUser();
    const uid = u.user?.id ?? "";
    const [sys, acc, role] = await Promise.all([
      supabase.from("portal_systems").select("id,slug,name,description,path").eq("active", true).order("sort_order"),
      supabase.from("user_system_access").select("system_id").eq("user_id", uid),
      supabase.from("user_roles").select("role").eq("user_id", uid).eq("role", "admin").maybeSingle(),
    ]);
    if (sys.error) throw sys.error;
    const isAdmin = !!role.data;
    const granted = new Set((acc.data ?? []).map((a) => a.system_id));
    const systems: PortalSystem[] = (sys.data ?? []).map((s) => ({ ...s, granted: isAdmin || granted.has(s.id) }));
    const name = (u.user?.user_metadata?.display_name as string | undefined) ?? u.user?.email?.split("@")[0] ?? "";
    return { systems, isAdmin, email: u.user?.email, name };
  },
});
