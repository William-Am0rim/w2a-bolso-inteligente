GRANT INSERT, UPDATE, DELETE ON public.portal_systems TO authenticated;
CREATE POLICY "admin insert systems" ON public.portal_systems FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin update systems" ON public.portal_systems FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin delete systems" ON public.portal_systems FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;