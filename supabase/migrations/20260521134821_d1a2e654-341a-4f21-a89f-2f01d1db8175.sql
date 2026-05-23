
-- Allow admins to delete applications
CREATE POLICY "Admins can delete applications"
ON public.applications
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Public bucket for task template cover images
INSERT INTO storage.buckets (id, name, public)
VALUES ('task-images', 'task-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Task images publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'task-images');

CREATE POLICY "Admins upload task images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'task-images' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins update task images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'task-images' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins delete task images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'task-images' AND public.has_role(auth.uid(), 'admin'::public.app_role));
