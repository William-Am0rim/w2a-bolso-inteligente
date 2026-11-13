DROP POLICY "systems read" ON public.portal_systems;
CREATE POLICY "systems read granted" ON public.portal_systems FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (SELECT 1 FROM public.user_system_access a WHERE a.system_id = portal_systems.id AND a.user_id = auth.uid())
);