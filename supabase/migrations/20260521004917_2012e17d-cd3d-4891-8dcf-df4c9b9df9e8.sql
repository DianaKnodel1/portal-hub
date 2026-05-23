ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS birth_name text,
  ADD COLUMN IF NOT EXISTS family_status text,
  ADD COLUMN IF NOT EXISTS birth_country text,
  ADD COLUMN IF NOT EXISTS health_insurance text,
  ADD COLUMN IF NOT EXISTS current_activity text;