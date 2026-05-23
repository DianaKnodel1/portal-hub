CREATE OR REPLACE FUNCTION public.admin_get_email_confirmations()
RETURNS TABLE(user_id uuid, email_confirmed boolean)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
    SELECT u.id, (u.email_confirmed_at IS NOT NULL) AS email_confirmed
    FROM auth.users u;
END;
$$;