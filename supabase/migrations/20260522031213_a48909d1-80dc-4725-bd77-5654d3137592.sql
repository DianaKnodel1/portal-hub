
CREATE OR REPLACE FUNCTION public.forward_inbound_sms_to_chat()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _leader_id uuid;
BEGIN
  IF NEW.direction <> 'inbound' OR NEW.user_id IS NULL THEN
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

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_forward_inbound_sms_to_chat ON public.sms_messages;
CREATE TRIGGER trg_forward_inbound_sms_to_chat
AFTER INSERT ON public.sms_messages
FOR EACH ROW
EXECUTE FUNCTION public.forward_inbound_sms_to_chat();
