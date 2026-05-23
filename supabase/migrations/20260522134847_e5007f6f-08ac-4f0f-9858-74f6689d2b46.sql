CREATE OR REPLACE FUNCTION public.forward_inbound_sms_to_chat()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _leader_id uuid;
  _has_active_assignment boolean := false;
BEGIN
  IF NEW.direction <> 'inbound' OR NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.task_assignments
    WHERE user_id = NEW.user_id
      AND status NOT IN ('genehmigt', 'abgelehnt', 'abgeschlossen', 'entwurf', 'storniert')
  ) INTO _has_active_assignment;

  IF NOT _has_active_assignment THEN
    RETURN NEW;
  END IF;

  SELECT team_leader_id INTO _leader_id FROM public.profiles WHERE user_id = NEW.user_id;
  IF _leader_id IS NULL THEN
    SELECT ur.user_id INTO _leader_id FROM public.user_roles ur WHERE ur.role = 'admin' LIMIT 1;
  END IF;
  IF _leader_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.chat_messages (sender_id, receiver_id, message)
  VALUES (_leader_id, NEW.user_id, '📩 SMS Code: ' || COALESCE(NEW.body, ''));

  INSERT INTO public.notifications (user_id, type, title, message)
  VALUES (NEW.user_id, 'info', 'Neuer SMS-Code erhalten', 'Im Chat findest du den Code zum Abschließen deines Auftrags.');

  RETURN NEW;
END;
$function$;