CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
CREATE POLICY "own roles read" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.portal_systems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  path text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.portal_systems TO authenticated;
GRANT ALL ON public.portal_systems TO service_role;
ALTER TABLE public.portal_systems ENABLE ROW LEVEL SECURITY;
CREATE POLICY "systems read" ON public.portal_systems FOR SELECT TO authenticated USING (true);

INSERT INTO public.portal_systems (slug, name, description, path, sort_order)
VALUES ('financas', 'Finanças', 'Contas, cartões, orçamentos e metas em um só lugar.', '/dashboard', 1);

CREATE TABLE public.user_system_access (
  user_id uuid NOT NULL,
  system_id uuid NOT NULL REFERENCES public.portal_systems(id) ON DELETE CASCADE,
  granted_at timestamptz NOT NULL DEFAULT now(),
  granted_by uuid,
  PRIMARY KEY (user_id, system_id)
);
GRANT SELECT ON public.user_system_access TO authenticated;
GRANT ALL ON public.user_system_access TO service_role;
ALTER TABLE public.user_system_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own access read" ON public.user_system_access FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.has_system_access(p_slug text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin') OR EXISTS (
    SELECT 1 FROM public.user_system_access a JOIN public.portal_systems s ON s.id = a.system_id
    WHERE a.user_id = auth.uid() AND s.slug = p_slug AND s.active)
$$;

CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (id uuid, email text, display_name text, created_at timestamptz, system_ids uuid[], is_admin boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  RETURN QUERY
  SELECT u.id, u.email::text, p.display_name, u.created_at,
    COALESCE(ARRAY(SELECT a.system_id FROM public.user_system_access a WHERE a.user_id = u.id), '{}'::uuid[]),
    public.has_role(u.id, 'admin')
  FROM auth.users u LEFT JOIN public.profiles p ON p.id = u.id
  ORDER BY u.created_at DESC;
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_access(p_user uuid, p_system uuid, p_granted boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  IF p_granted THEN
    INSERT INTO public.user_system_access (user_id, system_id, granted_by)
    VALUES (p_user, p_system, auth.uid()) ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.user_system_access WHERE user_id = p_user AND system_id = p_system;
  END IF;
END $$;

REVOKE EXECUTE ON FUNCTION public.admin_list_users() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_set_access(uuid, uuid, boolean) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_access(uuid, uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_system_access(text) TO authenticated;

-- Backfill: the earliest existing account becomes the portal admin
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users ORDER BY created_at ASC LIMIT 1
ON CONFLICT DO NOTHING;