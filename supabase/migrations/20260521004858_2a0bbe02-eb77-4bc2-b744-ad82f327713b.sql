SET check_function_bodies = false;
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TYPE public.booking_status AS ENUM ('gebucht', 'bestätigt', 'abgeschlossen', 'storniert');
CREATE TYPE public.document_category AS ENUM ('identitaet', 'auftrag', 'sonstiges');
CREATE TYPE public.document_status AS ENUM ('hochgeladen', 'geprueft', 'abgelehnt');
CREATE TYPE public.employee_status AS ENUM ('registriert', 'angenommen', 'abgelehnt', 'deaktiviert');
CREATE TYPE public.employment_type AS ENUM ('minijob', 'teilzeit', 'vollzeit');
CREATE TYPE public.kyc_status AS ENUM ('nicht_gestartet', 'eingereicht', 'in_pruefung', 'verifiziert', 'abgelehnt');
CREATE TYPE public.onboarding_status AS ENUM ('nicht_gestartet', 'in_bearbeitung', 'abgeschlossen');
CREATE TYPE public.task_assignment_status AS ENUM ('entwurf', 'zugewiesen', 'geplant', 'in_bearbeitung', 'eingereicht', 'in_pruefung', 'genehmigt', 'abgelehnt', 'nachbesserung', 'abgeschlossen');
CREATE TYPE public.transaction_status AS ENUM ('ausstehend', 'gutgeschrieben', 'genehmigt', 'ausgezahlt');

-- TABLES
CREATE TABLE public.tenants (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    name text NOT NULL,
    domain text NOT NULL UNIQUE,
    is_active boolean DEFAULT true NOT NULL,
    primary_color text DEFAULT '#3B82F6',
    logo_url text,
    sender_email text, sender_name text, reply_to_email text,
    smtp_host text, smtp_port integer DEFAULT 587, smtp_username text, smtp_password text,
    team_leader_name text DEFAULT 'Teamleiter' NOT NULL,
    team_leader_title text DEFAULT 'Dein Ansprechpartner' NOT NULL,
    team_leader_avatar_url text, team_leader_online boolean DEFAULT true,
    welcome_email_subject text DEFAULT 'Willkommen im Team!', welcome_email_body text,
    reset_email_subject text DEFAULT 'Passwort zurücksetzen', reset_email_body text,
    email_signature text, whatsapp_number text,
    default_task_template_id uuid,
    company_city text, company_ceo_name text, company_signature_url text,
    created_at timestamptz DEFAULT now() NOT NULL, updated_at timestamptz DEFAULT now() NOT NULL,
    smtp_debug_enabled boolean DEFAULT false NOT NULL, company_email text,
    hero_title text DEFAULT 'Werde Teil unseres Teams' NOT NULL,
    hero_subtitle text DEFAULT 'Bewirb dich jetzt' NOT NULL,
    features jsonb DEFAULT '[]'::jsonb NOT NULL,
    team_leader_response_time text DEFAULT 'Antwortet in wenigen Minuten' NOT NULL,
    company_address text, company_contact_person text,
    company_signer_name text, company_signer_title text, contract_additions text,
    ai_enabled boolean DEFAULT true NOT NULL, ai_system_prompt text,
    ai_escalation_keywords text[] DEFAULT ARRAY[]::text[],
    ai_model text DEFAULT 'google/gemini-2.5-flash',
    ai_language_style text DEFAULT 'freundlich',
    ai_fallback_text text, ai_faq_entries jsonb DEFAULT '[]'::jsonb
);

CREATE VIEW public.tenants_public WITH (security_invoker='on') AS
 SELECT id, name, domain, primary_color, logo_url, team_leader_name, team_leader_title,
    team_leader_avatar_url, team_leader_online, team_leader_response_time, whatsapp_number,
    company_ceo_name, company_address, company_city, company_signature_url,
    hero_title, hero_subtitle, features, is_active
   FROM public.tenants WHERE is_active = true;

CREATE TABLE public.activity_log (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, actor_id uuid NOT NULL, action text NOT NULL, entity_type text NOT NULL, entity_id uuid, old_status text, new_status text, comment text, created_at timestamptz DEFAULT now() NOT NULL);
CREATE TABLE public.admin_notes (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, profile_user_id uuid NOT NULL, content text DEFAULT '' NOT NULL, created_by uuid NOT NULL, created_at timestamptz DEFAULT now() NOT NULL, updated_at timestamptz DEFAULT now() NOT NULL);
CREATE TABLE public.applications (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, full_name text NOT NULL, first_name text, last_name text, email text NOT NULL, phone text, address text, postal_code text, city text, birth_date text, birth_place text, nationality text, message text, status text DEFAULT 'neu' NOT NULL, tenant_id uuid REFERENCES public.tenants(id), created_at timestamptz DEFAULT now() NOT NULL);
CREATE TABLE public.task_templates (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, title text NOT NULL, description text DEFAULT '' NOT NULL, instructions text DEFAULT '' NOT NULL, compensation numeric(10,2) DEFAULT 0 NOT NULL, image_url text, is_active boolean DEFAULT true NOT NULL, is_published boolean DEFAULT true NOT NULL, version integer DEFAULT 1 NOT NULL, created_by uuid NOT NULL, created_at timestamptz DEFAULT now() NOT NULL, updated_at timestamptz DEFAULT now() NOT NULL);
CREATE TABLE public.task_assignments (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, user_id uuid NOT NULL, task_template_id uuid NOT NULL REFERENCES public.task_templates(id) ON DELETE CASCADE, status public.task_assignment_status DEFAULT 'zugewiesen' NOT NULL, sms_channel_id uuid, release_at timestamptz, created_at timestamptz DEFAULT now() NOT NULL, updated_at timestamptz DEFAULT now() NOT NULL, admin_comment text, individual_email text, individual_password text, individual_case_number text, individual_phone text, individual_hint text, post_ident_pdf_url text, post_ident_pdf_name text);
CREATE TABLE public.time_slots (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, slot_date date NOT NULL, start_time time NOT NULL, end_time time NOT NULL, max_participants integer DEFAULT 1 NOT NULL, created_by uuid NOT NULL, created_at timestamptz DEFAULT now() NOT NULL, updated_at timestamptz DEFAULT now() NOT NULL);
CREATE TABLE public.bookings (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, user_id uuid NOT NULL, time_slot_id uuid REFERENCES public.time_slots(id) ON DELETE CASCADE, assignment_id uuid REFERENCES public.task_assignments(id) ON DELETE SET NULL, status public.booking_status DEFAULT 'gebucht' NOT NULL, booking_date date, booking_time time, created_at timestamptz DEFAULT now() NOT NULL, admin_override boolean DEFAULT false NOT NULL);
CREATE TABLE public.chat_conversations (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, user_id uuid NOT NULL, status text DEFAULT 'ai' NOT NULL, escalated_at timestamptz, created_at timestamptz DEFAULT now() NOT NULL, updated_at timestamptz DEFAULT now() NOT NULL);
CREATE TABLE public.chat_messages (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, sender_id uuid NOT NULL, receiver_id uuid NOT NULL, message text NOT NULL, read boolean DEFAULT false NOT NULL, is_ai boolean DEFAULT false NOT NULL, conversation_id uuid REFERENCES public.chat_conversations(id), created_at timestamptz DEFAULT now() NOT NULL);
CREATE TABLE public.contract_templates (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES public.tenants(id), title text DEFAULT 'Standardvertrag' NOT NULL, employment_type public.employment_type NOT NULL, content text DEFAULT '' NOT NULL, body_html text DEFAULT '' NOT NULL, is_active boolean DEFAULT true NOT NULL, version integer DEFAULT 1 NOT NULL, created_at timestamptz DEFAULT now() NOT NULL, updated_at timestamptz DEFAULT now() NOT NULL);
CREATE TABLE public.contracts (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, user_id uuid NOT NULL, tenant_id uuid REFERENCES public.tenants(id), employment_type public.employment_type NOT NULL, generated_content text NOT NULL, signed_name text NOT NULL, signature_image_url text, company_signature_url text, signed_at timestamptz DEFAULT now() NOT NULL, pdf_url text, metadata jsonb DEFAULT '{}'::jsonb, created_at timestamptz DEFAULT now() NOT NULL);
CREATE TABLE public.documents (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, user_id uuid NOT NULL, tenant_id uuid REFERENCES public.tenants(id), file_name text NOT NULL, file_url text NOT NULL, file_size integer, mime_type text, category public.document_category DEFAULT 'sonstiges' NOT NULL, status public.document_status DEFAULT 'hochgeladen' NOT NULL, uploaded_by uuid NOT NULL, notes text, created_at timestamptz DEFAULT now() NOT NULL, updated_at timestamptz DEFAULT now() NOT NULL);
CREATE TABLE public.email_send_log (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, message_id text NOT NULL, template_name text, recipient_email text NOT NULL, status text DEFAULT 'pending' NOT NULL, error_message text, metadata jsonb, created_at timestamptz DEFAULT now() NOT NULL);
CREATE TABLE public.email_send_state (id integer DEFAULT 1 PRIMARY KEY, rate_limited_until timestamptz, batch_size integer DEFAULT 10 NOT NULL, send_delay_ms integer DEFAULT 200 NOT NULL, auth_email_ttl_minutes integer DEFAULT 15 NOT NULL, transactional_email_ttl_minutes integer DEFAULT 60 NOT NULL);
CREATE TABLE public.email_unsubscribe_tokens (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, email text NOT NULL, token text DEFAULT encode(extensions.gen_random_bytes(32), 'hex') NOT NULL UNIQUE, used boolean DEFAULT false NOT NULL, created_at timestamptz DEFAULT now() NOT NULL);
CREATE TABLE public.invitation_tokens (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, token text DEFAULT encode(extensions.gen_random_bytes(32), 'hex') NOT NULL UNIQUE, email text NOT NULL, tenant_id uuid NOT NULL REFERENCES public.tenants(id), application_id uuid REFERENCES public.applications(id), used boolean DEFAULT false NOT NULL, used_at timestamptz, created_at timestamptz DEFAULT now() NOT NULL);
CREATE TABLE public.kyc_verifications (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE, id_front_url text, id_back_url text, selfie_url text, status public.kyc_status DEFAULT 'nicht_gestartet' NOT NULL, rejection_reason text, risk_flag boolean DEFAULT false NOT NULL, reviewed_by uuid REFERENCES auth.users(id), reviewed_at timestamptz, created_at timestamptz DEFAULT now() NOT NULL, updated_at timestamptz DEFAULT now() NOT NULL);
CREATE TABLE public.notifications (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, user_id uuid NOT NULL, type text DEFAULT 'info' NOT NULL, title text NOT NULL, message text DEFAULT '' NOT NULL, read boolean DEFAULT false NOT NULL, created_at timestamptz DEFAULT now() NOT NULL);
CREATE TABLE public.profiles (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE, full_name text NOT NULL, address text, street text, zip_code text, city text, birth_date date, birth_place text, nationality text, living_since date, previous_address text, employment_type public.employment_type, contract_signed_at timestamptz, signature_url text, tax_number text, social_security_number text, iban text, status public.employee_status DEFAULT 'registriert' NOT NULL, onboarding_status public.onboarding_status DEFAULT 'nicht_gestartet' NOT NULL, application_id uuid, tenant_id uuid REFERENCES public.tenants(id), team_leader_id uuid, admin_notes text DEFAULT '', leader_title text DEFAULT '', leader_avatar_url text, leader_online boolean DEFAULT true, last_reminder_sent_at timestamptz, created_at timestamptz DEFAULT now() NOT NULL, updated_at timestamptz DEFAULT now() NOT NULL, employment_start_date date, phone text);
CREATE TABLE public.sms_channels (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, label text DEFAULT '' NOT NULL, phone_number text NOT NULL, provider text DEFAULT 'twilio' NOT NULL, api_key text, api_secret text, is_active boolean DEFAULT true NOT NULL, tenant_id uuid REFERENCES public.tenants(id), created_at timestamptz DEFAULT now() NOT NULL, updated_at timestamptz DEFAULT now() NOT NULL);
CREATE TABLE public.sms_assignments (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, user_id uuid NOT NULL, sms_channel_id uuid NOT NULL REFERENCES public.sms_channels(id) ON DELETE CASCADE, is_active boolean DEFAULT true NOT NULL, assigned_at timestamptz DEFAULT now() NOT NULL, assigned_by uuid NOT NULL, created_at timestamptz DEFAULT now() NOT NULL, updated_at timestamptz DEFAULT now() NOT NULL, note text DEFAULT '', UNIQUE (user_id, sms_channel_id));
CREATE TABLE public.sms_messages (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, channel_id uuid REFERENCES public.sms_channels(id), assignment_id uuid REFERENCES public.task_assignments(id), user_id uuid, tenant_id uuid REFERENCES public.tenants(id), direction text DEFAULT 'inbound' NOT NULL, from_number text DEFAULT '' NOT NULL, to_number text DEFAULT '' NOT NULL, body text DEFAULT '' NOT NULL, media_url text, status text DEFAULT 'received' NOT NULL, provider_message_id text, created_at timestamptz DEFAULT now() NOT NULL);
CREATE TABLE public.sms_settings (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, provider text DEFAULT 'anosim' NOT NULL, api_key text DEFAULT '' NOT NULL, created_at timestamptz DEFAULT now() NOT NULL, updated_at timestamptz DEFAULT now() NOT NULL);
CREATE TABLE public.step_feedback (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, assignment_id uuid NOT NULL REFERENCES public.task_assignments(id) ON DELETE CASCADE, step_number integer NOT NULL, block_id text, comment text DEFAULT '' NOT NULL, resolved boolean DEFAULT false NOT NULL, created_at timestamptz DEFAULT now() NOT NULL, created_by uuid NOT NULL);
CREATE TABLE public.task_questions (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, task_template_id uuid NOT NULL REFERENCES public.task_templates(id) ON DELETE CASCADE, question text NOT NULL, sort_order integer DEFAULT 0 NOT NULL, question_type text DEFAULT 'text' NOT NULL, options jsonb DEFAULT '[]'::jsonb, is_required boolean DEFAULT false NOT NULL, created_at timestamptz DEFAULT now() NOT NULL);
CREATE TABLE public.task_steps (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, task_template_id uuid NOT NULL REFERENCES public.task_templates(id) ON DELETE CASCADE, step_number integer DEFAULT 1 NOT NULL, title text DEFAULT '' NOT NULL, description text DEFAULT '' NOT NULL, content_blocks jsonb DEFAULT '[]'::jsonb NOT NULL, is_required boolean DEFAULT true NOT NULL, button_label text DEFAULT 'Weiter' NOT NULL, created_at timestamptz DEFAULT now() NOT NULL, updated_at timestamptz DEFAULT now() NOT NULL);
CREATE TABLE public.task_submissions (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, assignment_id uuid NOT NULL REFERENCES public.task_assignments(id) ON DELETE CASCADE, notes text, review_comment text, review_status text DEFAULT 'pending', created_at timestamptz DEFAULT now() NOT NULL, updated_at timestamptz DEFAULT now() NOT NULL, file_urls text[] DEFAULT '{}'::text[] NOT NULL, submitted_at timestamptz DEFAULT now() NOT NULL);
CREATE TABLE public.submission_answers (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, submission_id uuid NOT NULL REFERENCES public.task_submissions(id) ON DELETE CASCADE, question_id uuid NOT NULL REFERENCES public.task_questions(id) ON DELETE CASCADE, answer text DEFAULT '' NOT NULL);
CREATE TABLE public.task_progress (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, assignment_id uuid NOT NULL UNIQUE REFERENCES public.task_assignments(id) ON DELETE CASCADE, user_id uuid NOT NULL, current_step integer DEFAULT 0 NOT NULL, completed_steps integer[] DEFAULT '{}'::integer[] NOT NULL, answers jsonb DEFAULT '{}'::jsonb NOT NULL, updated_at timestamptz DEFAULT now() NOT NULL);
CREATE TABLE public.suppressed_emails (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, email text NOT NULL, reason text NOT NULL, source text, created_at timestamptz DEFAULT now() NOT NULL);
CREATE TABLE public.system_settings (id integer DEFAULT 1 PRIMARY KEY, openai_api_key text, updated_at timestamptz DEFAULT now() NOT NULL, updated_by uuid, CONSTRAINT system_settings_singleton CHECK (id = 1));
CREATE TABLE public.user_roles (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, role public.app_role NOT NULL, UNIQUE (user_id, role));
CREATE TABLE public.user_transactions (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, user_id uuid NOT NULL, assignment_id uuid NOT NULL REFERENCES public.task_assignments(id) ON DELETE CASCADE, amount numeric(10,2) NOT NULL, status public.transaction_status DEFAULT 'ausstehend' NOT NULL, created_at timestamptz DEFAULT now() NOT NULL, updated_at timestamptz DEFAULT now() NOT NULL);

-- FUNCTIONS
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name) VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.admin_get_user_contact(_user_id uuid) RETURNS TABLE(email text, phone text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN QUERY SELECT u.email::text, u.phone::text FROM auth.users u WHERE u.id = _user_id LIMIT 1;
END; $$;

CREATE OR REPLACE FUNCTION public.auto_activate_on_contract_signed() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF OLD.contract_signed_at IS NULL AND NEW.contract_signed_at IS NOT NULL THEN
    INSERT INTO public.activity_log (actor_id, action, entity_type, entity_id, old_status, new_status, comment)
    VALUES (NEW.user_id, 'vertrag_unterschrieben', 'profile', NEW.user_id, OLD.status::text, NEW.status::text, 'Vertrag unterschrieben');
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.auto_assign_default_task() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _template_id UUID; _existing INT;
BEGIN
  IF OLD.status = 'angenommen' OR NEW.status <> 'angenommen' THEN RETURN NEW; END IF;
  IF NEW.tenant_id IS NULL THEN RETURN NEW; END IF;
  SELECT default_task_template_id INTO _template_id FROM public.tenants WHERE id = NEW.tenant_id;
  IF _template_id IS NULL THEN RETURN NEW; END IF;
  SELECT count(*) INTO _existing FROM public.task_assignments WHERE user_id = NEW.user_id AND task_template_id = _template_id;
  IF _existing > 0 THEN RETURN NEW; END IF;
  INSERT INTO public.task_assignments (user_id, task_template_id, status) VALUES (NEW.user_id, _template_id, 'zugewiesen');
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.auto_assign_team_leader() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _leader_id UUID;
BEGIN
  IF NEW.team_leader_id IS NOT NULL THEN RETURN NEW; END IF;
  SELECT ur.user_id INTO _leader_id FROM public.user_roles ur WHERE ur.role = 'admin'
  ORDER BY (SELECT count(*) FROM public.profiles p WHERE p.team_leader_id = ur.user_id) ASC, ur.user_id ASC LIMIT 1;
  IF _leader_id IS NOT NULL THEN NEW.team_leader_id := _leader_id; END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.consume_invitation_token(_token text) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$ UPDATE public.invitation_tokens SET used = true, used_at = now() WHERE token = _token AND used = false; $$;

CREATE OR REPLACE FUNCTION public.get_first_active_public_tenant() RETURNS SETOF public.tenants_public LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$ SELECT * FROM public.tenants_public WHERE is_active = true LIMIT 1; $$;

CREATE OR REPLACE FUNCTION public.get_public_tenant_by_domain(_domain text) RETURNS SETOF public.tenants_public LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$ SELECT * FROM public.tenants_public WHERE domain = _domain AND is_active = true LIMIT 1; $$;

CREATE OR REPLACE FUNCTION public.get_my_sms_assignments() RETURNS TABLE(assignment_id uuid, is_active boolean, note text, assigned_at timestamptz, channel_id uuid, label text, phone_number text, provider text, channel_is_active boolean) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT sa.id, sa.is_active, COALESCE(sa.note, ''), sa.assigned_at, sc.id, COALESCE(sc.label, ''), sc.phone_number, sc.provider, sc.is_active
  FROM public.sms_assignments sa JOIN public.sms_channels sc ON sc.id = sa.sms_channel_id
  WHERE sa.user_id = auth.uid() AND sa.is_active = true;
$$;

CREATE OR REPLACE FUNCTION public.protect_admin_profile() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = OLD.user_id AND role = 'admin') THEN RAISE EXCEPTION 'Admin-Profile dürfen nicht gelöscht werden'; END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.status = 'deaktiviert' THEN
    IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.user_id AND role = 'admin') THEN RAISE EXCEPTION 'Admin-Accounts dürfen nicht deaktiviert werden'; END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.protect_last_admin_role() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE admin_count INT;
BEGIN
  IF OLD.role = 'admin' THEN
    SELECT count(*) INTO admin_count FROM public.user_roles WHERE role = 'admin' AND id != OLD.id;
    IF admin_count = 0 THEN RAISE EXCEPTION 'Der letzte Admin-Account darf nicht entfernt werden'; END IF;
  END IF;
  RETURN OLD;
END; $$;

CREATE OR REPLACE FUNCTION public.send_chat_on_kyc_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _leader_id UUID;
BEGIN
  IF OLD.status != 'verifiziert' AND NEW.status = 'verifiziert' THEN
    SELECT team_leader_id INTO _leader_id FROM public.profiles WHERE user_id = NEW.user_id;
    IF _leader_id IS NOT NULL THEN
      INSERT INTO public.chat_messages (sender_id, receiver_id, message) VALUES (_leader_id, NEW.user_id, 'Verifizierung bestätigt!');
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.send_chat_on_task_assignment() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _leader_id UUID; _task_title TEXT;
BEGIN
  SELECT team_leader_id INTO _leader_id FROM public.profiles WHERE user_id = NEW.user_id;
  SELECT title INTO _task_title FROM public.task_templates WHERE id = NEW.task_template_id;
  IF _leader_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.chat_messages (sender_id, receiver_id, message) VALUES (_leader_id, NEW.user_id, 'Neuer Auftrag: ' || COALESCE(_task_title, 'Neuer Auftrag'));
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.send_system_chat_on_profile_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.team_leader_id IS NULL THEN RETURN NEW; END IF;
  IF OLD.contract_signed_at IS NULL AND NEW.contract_signed_at IS NOT NULL THEN
    INSERT INTO public.chat_messages (sender_id, receiver_id, message) VALUES (NEW.team_leader_id, NEW.user_id, 'Vertrag unterschrieben!');
  END IF;
  IF OLD.onboarding_status IS DISTINCT FROM 'abgeschlossen' AND NEW.onboarding_status = 'abgeschlossen' THEN
    INSERT INTO public.chat_messages (sender_id, receiver_id, message) VALUES (NEW.team_leader_id, NEW.user_id, 'Einführung abgeschlossen!');
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.send_welcome_chat_message() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.team_leader_id IS NOT NULL THEN
    INSERT INTO public.chat_messages (sender_id, receiver_id, message)
    VALUES (NEW.team_leader_id, NEW.user_id, 'Hallo ' || COALESCE(NULLIF(split_part(NEW.full_name, ' ', 1), ''), '') || '! Willkommen im Team!');
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.validate_booking_rules() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _caller_is_admin BOOLEAN := false; _target_is_admin BOOLEAN := false; _active_count INT := 0; _same_day_count INT := 0; _slot_date DATE; _slot_start TIME; _emp_status TEXT;
BEGIN
  SELECT public.has_role(auth.uid(), 'admin'::public.app_role) INTO _caller_is_admin;
  IF COALESCE(_caller_is_admin, false) THEN RETURN NEW; END IF;
  IF COALESCE(NEW.admin_override, false) THEN RETURN NEW; END IF;
  SELECT public.has_role(NEW.user_id, 'admin'::public.app_role) INTO _target_is_admin;
  IF COALESCE(_target_is_admin, false) THEN RETURN NEW; END IF;
  SELECT p.status::text INTO _emp_status FROM public.profiles p WHERE p.user_id = NEW.user_id;
  IF _emp_status IS NULL OR _emp_status <> 'angenommen' THEN RAISE EXCEPTION 'Du wurdest noch nicht freigeschaltet.'; END IF;
  IF NEW.time_slot_id IS NOT NULL THEN
    SELECT ts.slot_date, ts.start_time INTO _slot_date, _slot_start FROM public.time_slots ts WHERE ts.id = NEW.time_slot_id;
    IF _slot_date IS NULL OR _slot_start IS NULL THEN RAISE EXCEPTION 'Ungültiger Zeitslot.'; END IF;
  ELSE
    _slot_date := NEW.booking_date; _slot_start := NEW.booking_time;
    IF _slot_date IS NULL OR _slot_start IS NULL THEN RAISE EXCEPTION 'Ungültiger Zeitslot.'; END IF;
  END IF;
  IF (_slot_date::timestamp + _slot_start) < (now() + interval '24 hours') THEN RAISE EXCEPTION 'Buchung mindestens 24 Stunden im Voraus.'; END IF;
  IF _slot_start < '09:00'::time OR _slot_start >= '20:00'::time THEN RAISE EXCEPTION 'Termine nur zwischen 09:00 und 20:00 Uhr.'; END IF;
  SELECT count(*) INTO _same_day_count FROM public.bookings b LEFT JOIN public.time_slots ts ON ts.id = b.time_slot_id
    WHERE b.user_id = NEW.user_id AND b.status IN ('gebucht', 'bestätigt') AND COALESCE(ts.slot_date, b.booking_date) = _slot_date;
  IF _same_day_count >= 1 THEN RAISE EXCEPTION 'Pro Tag ist nur ein Termin möglich.'; END IF;
  SELECT count(*) INTO _active_count FROM public.bookings b WHERE b.user_id = NEW.user_id AND b.status IN ('gebucht', 'bestätigt');
  IF _active_count >= 3 THEN RAISE EXCEPTION 'Maximal 3 offene Termine erlaubt.'; END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.validate_invitation_token(_token text) RETURNS TABLE(email text, tenant_id uuid, application_id uuid, used boolean) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT email, tenant_id, application_id, used FROM public.invitation_tokens WHERE token = _token LIMIT 1;
$$;

-- TRIGGERS
CREATE TRIGGER protect_admin_profile_trigger BEFORE DELETE OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_admin_profile();
CREATE TRIGGER protect_last_admin_role_trigger BEFORE DELETE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.protect_last_admin_role();
CREATE TRIGGER trg_auto_activate_on_contract BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.auto_activate_on_contract_signed();
CREATE TRIGGER trg_auto_assign_default_task AFTER UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.auto_assign_default_task();
CREATE TRIGGER trg_auto_assign_team_leader BEFORE INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.auto_assign_team_leader();
CREATE TRIGGER trg_chat_on_kyc_change AFTER UPDATE ON public.kyc_verifications FOR EACH ROW EXECUTE FUNCTION public.send_chat_on_kyc_change();
CREATE TRIGGER trg_chat_on_task_assignment AFTER INSERT OR UPDATE ON public.task_assignments FOR EACH ROW EXECUTE FUNCTION public.send_chat_on_task_assignment();
CREATE TRIGGER trg_send_welcome_chat AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.send_welcome_chat_message();
CREATE TRIGGER trg_system_chat_on_profile_change AFTER UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.send_system_chat_on_profile_change();
CREATE TRIGGER update_kyc_updated_at BEFORE UPDATE ON public.kyc_verifications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_sms_assignments_updated_at BEFORE UPDATE ON public.sms_assignments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_sms_settings_updated_at BEFORE UPDATE ON public.sms_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_system_settings_updated_at BEFORE UPDATE ON public.system_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_task_assignments_updated_at BEFORE UPDATE ON public.task_assignments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_task_templates_updated_at BEFORE UPDATE ON public.task_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER validate_booking_rules_trigger BEFORE INSERT ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.validate_booking_rules();

-- Auth trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS ENABLE
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_send_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_send_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_unsubscribe_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitation_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kyc_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.step_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submission_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppressed_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_transactions ENABLE ROW LEVEL SECURITY;

-- POLICIES
CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can update all kyc" ON public.kyc_verifications FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can update all profiles" ON public.profiles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can update applications" ON public.applications FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can view all applications" ON public.applications FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can view all kyc" ON public.kyc_verifications FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins insert activity_log" ON public.activity_log FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins insert contracts" ON public.contracts FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins manage admin_notes" ON public.admin_notes TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins manage answers" ON public.submission_answers TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins manage assignments" ON public.task_assignments TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins manage bookings" ON public.bookings TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins manage chat" ON public.chat_messages TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins manage contract_templates" ON public.contract_templates TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins manage conversations" ON public.chat_conversations TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins manage documents" ON public.documents TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins manage notifications" ON public.notifications TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins manage progress" ON public.task_progress TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins manage sms_assignments" ON public.sms_assignments TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins manage sms_channels" ON public.sms_channels TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins manage sms_messages" ON public.sms_messages TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins manage sms_settings" ON public.sms_settings TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins manage step_feedback" ON public.step_feedback TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins manage submissions" ON public.task_submissions TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins manage task_questions" ON public.task_questions TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins manage task_steps" ON public.task_steps TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins manage task_templates" ON public.task_templates TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins manage tenants" ON public.tenants TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins manage time_slots" ON public.time_slots TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins manage tokens" ON public.invitation_tokens TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins manage transactions" ON public.user_transactions TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins read all contracts" ON public.contracts FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins read invitation tokens" ON public.invitation_tokens FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins read system_settings" ON public.system_settings FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins update contracts" ON public.contracts FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins update system_settings" ON public.system_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins view activity_log" ON public.activity_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins view email_send_log" ON public.email_send_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins view suppressed_emails" ON public.suppressed_emails FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Anyone can submit applications" ON public.applications FOR INSERT TO authenticated, anon WITH CHECK (true);
CREATE POLICY "Service role can insert tokens" ON public.email_unsubscribe_tokens FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Service role can mark tokens as used" ON public.email_unsubscribe_tokens FOR UPDATE USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Service role can read tokens" ON public.email_unsubscribe_tokens FOR SELECT USING (auth.role() = 'service_role');
CREATE POLICY "Service role insert email_send_log" ON public.email_send_log FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Service role manage email_send_state" ON public.email_send_state USING (auth.role() = 'service_role');
CREATE POLICY "Service role manage suppressed_emails" ON public.suppressed_emails USING (auth.role() = 'service_role');
CREATE POLICY "Service role manage system_settings" ON public.system_settings USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Service role select email_send_log" ON public.email_send_log FOR SELECT USING (auth.role() = 'service_role');
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can mark own tokens used" ON public.invitation_tokens FOR UPDATE TO authenticated USING (email = (SELECT users.email FROM auth.users WHERE users.id = auth.uid())::text) WITH CHECK (email = (SELECT users.email FROM auth.users WHERE users.id = auth.uid())::text);
CREATE POLICY "Users can update own kyc" ON public.kyc_verifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can view own kyc" ON public.kyc_verifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own answers" ON public.submission_answers FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.task_submissions ts JOIN public.task_assignments ta ON ta.id = ts.assignment_id WHERE ts.id = submission_answers.submission_id AND ta.user_id = auth.uid()));
CREATE POLICY "Users insert own bookings" ON public.bookings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users insert own contracts" ON public.contracts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users insert own conversations" ON public.chat_conversations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users insert own kyc" ON public.kyc_verifications FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users insert own submissions" ON public.task_submissions FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.task_assignments WHERE task_assignments.id = task_submissions.assignment_id AND task_assignments.user_id = auth.uid()));
CREATE POLICY "Users mark received as read" ON public.chat_messages FOR UPDATE TO authenticated USING (auth.uid() = receiver_id);
CREATE POLICY "Users read assigned task_questions" ON public.task_questions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR EXISTS (SELECT 1 FROM public.task_assignments ta WHERE ta.task_template_id = task_questions.task_template_id AND ta.user_id = auth.uid()));
CREATE POLICY "Users read assigned task_steps" ON public.task_steps FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR EXISTS (SELECT 1 FROM public.task_assignments ta WHERE ta.task_template_id = task_steps.task_template_id AND ta.user_id = auth.uid()));
CREATE POLICY "Users read assigned templates" ON public.task_templates FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR EXISTS (SELECT 1 FROM public.task_assignments ta WHERE ta.task_template_id = task_templates.id AND ta.user_id = auth.uid()) OR id = (SELECT t.default_task_template_id FROM public.tenants t JOIN public.profiles p ON p.tenant_id = t.id WHERE p.user_id = auth.uid() LIMIT 1));
CREATE POLICY "Users read own contracts" ON public.contracts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users read own progress" ON public.task_progress FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users read own step_feedback" ON public.step_feedback FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.task_assignments ta WHERE ta.id = step_feedback.assignment_id AND ta.user_id = auth.uid()));
CREATE POLICY "Users read own tenant contract_templates" ON public.contract_templates FOR SELECT TO authenticated USING ((tenant_id = (SELECT profiles.tenant_id FROM public.profiles WHERE profiles.user_id = auth.uid() LIMIT 1)) OR public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Users read time_slots" ON public.time_slots FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users send messages" ON public.chat_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Users update own assignments" ON public.task_assignments FOR UPDATE TO authenticated USING (auth.uid() = user_id AND status <> 'entwurf'::public.task_assignment_status AND (release_at IS NULL OR release_at <= now()));
CREATE POLICY "Users update own bookings" ON public.bookings FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own conversations" ON public.chat_conversations FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users update own pending kyc" ON public.kyc_verifications FOR UPDATE TO authenticated USING (auth.uid() = user_id AND status <> 'verifiziert'::public.kyc_status) WITH CHECK (auth.uid() = user_id AND status <> 'verifiziert'::public.kyc_status);
CREATE POLICY "Users update own progress" ON public.task_progress FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users upload own documents" ON public.documents FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Users upsert own progress" ON public.task_progress FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users view own answers" ON public.submission_answers FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.task_submissions ts JOIN public.task_assignments ta ON ta.id = ts.assignment_id WHERE ts.id = submission_answers.submission_id AND ta.user_id = auth.uid()));
CREATE POLICY "Users view own assignments" ON public.task_assignments FOR SELECT TO authenticated USING (auth.uid() = user_id AND status <> 'entwurf'::public.task_assignment_status AND (release_at IS NULL OR release_at <= now()));
CREATE POLICY "Users view own bookings" ON public.bookings FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users view own conversations" ON public.chat_conversations FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users view own documents" ON public.documents FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users view own messages" ON public.chat_messages FOR SELECT TO authenticated USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "Users view own notifications" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users view own sms" ON public.sms_messages FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users view own sms_assignments" ON public.sms_assignments FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users view own submissions" ON public.task_submissions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.task_assignments WHERE task_assignments.id = task_submissions.assignment_id AND task_assignments.user_id = auth.uid()));
CREATE POLICY "Users view own transactions" ON public.user_transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);