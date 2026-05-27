-- Allow authenticated users to read their own tenant row.
-- Without this, employees can't load their company name on the contract page
-- and the UI falls back to the first active public tenant (Digital DGI GmbH).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='tenants' AND policyname='Users read own tenant'
  ) THEN
    CREATE POLICY "Users read own tenant"
      ON public.tenants
      FOR SELECT
      TO authenticated
      USING (
        id = (SELECT profiles.tenant_id FROM public.profiles WHERE profiles.user_id = auth.uid() LIMIT 1)
      );
  END IF;
END$$;
