-- Großes Update: Realtime-Chat, Performance-Index, Admin-Helper, Buckets

-- 1) Realtime auf chat_messages aktivieren
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'chat_messages'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages';
  END IF;
END $$;

-- 2) Indizes
CREATE INDEX IF NOT EXISTS idx_chat_messages_pair_time
  ON public.chat_messages (sender_id, receiver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_receiver_unread
  ON public.chat_messages (receiver_id, read) WHERE read = false;

-- 3) RPC: aggregierte Chat-Liste für Admin
CREATE OR REPLACE FUNCTION public.get_chat_thread_summaries(_admin_id uuid)
RETURNS TABLE (user_id uuid, full_name text, last_message text, last_at timestamptz, unread bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH partners AS (
    SELECT DISTINCT CASE WHEN sender_id = _admin_id THEN receiver_id ELSE sender_id END AS partner_id
    FROM public.chat_messages WHERE sender_id = _admin_id OR receiver_id = _admin_id
  ),
  last_msg AS (
    SELECT DISTINCT ON (partner_id) partner_id, message, created_at FROM (
      SELECT CASE WHEN sender_id = _admin_id THEN receiver_id ELSE sender_id END AS partner_id, message, created_at
      FROM public.chat_messages WHERE sender_id = _admin_id OR receiver_id = _admin_id
    ) s ORDER BY partner_id, created_at DESC
  ),
  unread AS (
    SELECT sender_id AS partner_id, COUNT(*) AS cnt FROM public.chat_messages
    WHERE receiver_id = _admin_id AND read = false GROUP BY sender_id
  )
  SELECT p.partner_id, pr.full_name, lm.message, lm.created_at, COALESCE(u.cnt, 0)
  FROM partners p
  LEFT JOIN public.profiles pr ON pr.user_id = p.partner_id
  LEFT JOIN last_msg lm ON lm.partner_id = p.partner_id
  LEFT JOIN unread u ON u.partner_id = p.partner_id
  WHERE public.has_role(_admin_id, 'admin'::public.app_role)
  ORDER BY lm.created_at DESC NULLS LAST;
$$;
GRANT EXECUTE ON FUNCTION public.get_chat_thread_summaries(uuid) TO authenticated;

-- 4) RPC: letzter Login (nur Admins)
CREATE OR REPLACE FUNCTION public.get_last_sign_ins(_user_ids uuid[])
RETURNS TABLE (user_id uuid, last_sign_in_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY SELECT u.id, u.last_sign_in_at FROM auth.users u WHERE u.id = ANY(_user_ids);
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_last_sign_ins(uuid[]) TO authenticated;

-- 5) Bucket team-leader-avatars sicherstellen
INSERT INTO storage.buckets (id, name, public)
VALUES ('team-leader-avatars', 'team-leader-avatars', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tla_public_read' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "tla_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'team-leader-avatars');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tla_admin_insert' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "tla_admin_insert" ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'team-leader-avatars' AND public.has_role(auth.uid(), 'admin'::public.app_role));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tla_admin_update' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "tla_admin_update" ON storage.objects FOR UPDATE TO authenticated
      USING (bucket_id = 'team-leader-avatars' AND public.has_role(auth.uid(), 'admin'::public.app_role));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tla_admin_delete' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "tla_admin_delete" ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'team-leader-avatars' AND public.has_role(auth.uid(), 'admin'::public.app_role));
  END IF;
END $$;
