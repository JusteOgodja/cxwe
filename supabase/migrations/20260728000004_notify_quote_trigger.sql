-- Email notification trigger: calls edge function notify-new-quote on INSERT
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION notify_admin_new_quote()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM net.http_post(
    url     := 'https://fknxppuvpdmcfhtfrjcx.supabase.co/functions/v1/notify-new-quote',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.supabase_service_key', true)
    ),
    body    := row_to_json(NEW)::text::jsonb
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_new_quote_notify ON quote_requests;
CREATE TRIGGER on_new_quote_notify
  AFTER INSERT ON quote_requests
  FOR EACH ROW EXECUTE FUNCTION notify_admin_new_quote();
