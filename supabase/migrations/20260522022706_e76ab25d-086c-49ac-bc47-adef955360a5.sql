-- 1) Add missing column for individual instructions
ALTER TABLE public.task_assignments
  ADD COLUMN IF NOT EXISTS individual_instructions text;

-- 2) Create missing private storage buckets
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('documents', 'documents', false),
  ('employee-documents', 'employee-documents', false),
  ('kyc-documents', 'kyc-documents', false),
  ('signatures', 'signatures', false),
  ('task-submissions', 'task-submissions', false)
ON CONFLICT (id) DO NOTHING;

-- 3) Storage policies
-- Admin full access on all listed buckets
CREATE POLICY "Admins full access on app buckets"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id IN ('documents','employee-documents','kyc-documents','signatures','task-submissions')
  AND public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  bucket_id IN ('documents','employee-documents','kyc-documents','signatures','task-submissions')
  AND public.has_role(auth.uid(), 'admin')
);

-- Users read their own files in user-owned buckets
CREATE POLICY "Users read own files in user buckets"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id IN ('documents','kyc-documents','signatures','task-submissions','employee-documents')
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Users upload to their own folder in user-writable buckets
CREATE POLICY "Users upload own files in user buckets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id IN ('documents','kyc-documents','signatures','task-submissions')
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Users update/delete their own files in user-writable buckets
CREATE POLICY "Users update own files in user buckets"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id IN ('documents','kyc-documents','signatures','task-submissions')
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users delete own files in user buckets"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id IN ('documents','kyc-documents','signatures','task-submissions')
  AND auth.uid()::text = (storage.foldername(name))[1]
);
