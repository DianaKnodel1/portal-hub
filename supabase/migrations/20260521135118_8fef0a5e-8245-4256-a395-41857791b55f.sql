
INSERT INTO storage.buckets (id, name, public)
VALUES ('team-leader-avatars', 'team-leader-avatars', true)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Team leader avatars publicly readable'
  ) THEN
    CREATE POLICY "Team leader avatars publicly readable"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'team-leader-avatars');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Admins upload team leader avatars'
  ) THEN
    CREATE POLICY "Admins upload team leader avatars"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'team-leader-avatars' AND public.has_role(auth.uid(), 'admin'::public.app_role));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Admins update team leader avatars'
  ) THEN
    CREATE POLICY "Admins update team leader avatars"
      ON storage.objects FOR UPDATE TO authenticated
      USING (bucket_id = 'team-leader-avatars' AND public.has_role(auth.uid(), 'admin'::public.app_role));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Admins delete team leader avatars'
  ) THEN
    CREATE POLICY "Admins delete team leader avatars"
      ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'team-leader-avatars' AND public.has_role(auth.uid(), 'admin'::public.app_role));
  END IF;
END $$;
