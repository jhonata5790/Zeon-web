-- Zeon v0.8.2 — mensagens privadas 1:1, aditivas; nao altera grupos ou perfis.
-- Aplicar uma vez no SQL Editor do projeto Supabase Consivo.
-- As mensagens nao tem criptografia ponta a ponta: participantes autorizados podem le-las.
BEGIN;

CREATE TABLE IF NOT EXISTS public.zeon_dm_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_b uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz,
  last_message_preview text,
  last_sender_id uuid,
  CONSTRAINT zeon_dm_threads_order CHECK (user_a < user_b),
  CONSTRAINT zeon_dm_threads_pair UNIQUE (user_a,user_b),
  CONSTRAINT zeon_dm_preview_length CHECK (last_message_preview IS NULL OR char_length(last_message_preview) <= 120)
);
CREATE INDEX IF NOT EXISTS zeon_dm_threads_a_recent ON public.zeon_dm_threads(user_a, last_message_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS zeon_dm_threads_b_recent ON public.zeon_dm_threads(user_b, last_message_at DESC NULLS LAST);

CREATE TABLE IF NOT EXISTS public.zeon_dm_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.zeon_dm_threads(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT zeon_dm_body_length CHECK (char_length(btrim(body)) BETWEEN 1 AND 700)
);
CREATE INDEX IF NOT EXISTS zeon_dm_messages_thread_recent ON public.zeon_dm_messages(thread_id, created_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS public.zeon_dm_reads (
  thread_id uuid NOT NULL REFERENCES public.zeon_dm_threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(thread_id,user_id)
);

ALTER TABLE public.zeon_dm_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zeon_dm_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zeon_dm_reads ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.zeon_dm_threads FROM PUBLIC,anon,authenticated;
REVOKE ALL ON public.zeon_dm_messages FROM PUBLIC,anon,authenticated;
REVOKE ALL ON public.zeon_dm_reads FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.zeon_dm_threads TO authenticated;
GRANT INSERT (user_a,user_b) ON public.zeon_dm_threads TO authenticated;
GRANT SELECT ON public.zeon_dm_messages TO authenticated;
GRANT INSERT (thread_id,author_id,body) ON public.zeon_dm_messages TO authenticated;
GRANT SELECT,INSERT,UPDATE ON public.zeon_dm_reads TO authenticated;

CREATE POLICY "Zeon DM thread visible only to participants"
  ON public.zeon_dm_threads FOR SELECT TO authenticated
  USING ((select auth.uid()) IN (user_a,user_b));
CREATE POLICY "Zeon DM participants can start threads"
  ON public.zeon_dm_threads FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) IN (user_a,user_b));
CREATE POLICY "Zeon DM messages visible only to participants"
  ON public.zeon_dm_messages FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.zeon_dm_threads t
    WHERE t.id = thread_id AND (select auth.uid()) IN (t.user_a,t.user_b)
  ));
CREATE POLICY "Zeon DM messages authored by a participant"
  ON public.zeon_dm_messages FOR INSERT TO authenticated
  WITH CHECK (author_id = (select auth.uid()) AND EXISTS (
    SELECT 1 FROM public.zeon_dm_threads t
    WHERE t.id = thread_id AND (select auth.uid()) IN (t.user_a,t.user_b)
  ));
CREATE POLICY "Zeon DM read receipt visible only to owner"
  ON public.zeon_dm_reads FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));
CREATE POLICY "Zeon DM own read receipt insert"
  ON public.zeon_dm_reads FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()) AND EXISTS (
    SELECT 1 FROM public.zeon_dm_threads t
    WHERE t.id = thread_id AND (select auth.uid()) IN (t.user_a,t.user_b)
  ));
CREATE POLICY "Zeon DM own read receipt update"
  ON public.zeon_dm_reads FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()) AND EXISTS (
    SELECT 1 FROM public.zeon_dm_threads t
    WHERE t.id = thread_id AND (select auth.uid()) IN (t.user_a,t.user_b)
  ));

-- Registro de ultima mensagem mantido somente por um gatilho interno.
-- Nao pode ser alterado por clientes autenticados comuns.
CREATE OR REPLACE FUNCTION public.zeon_dm_update_thread_summary()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE public.zeon_dm_threads
  SET last_message_at = NEW.created_at,
      last_message_preview = left(NEW.body,120),
      last_sender_id = NEW.author_id
  WHERE id=NEW.thread_id AND (last_message_at IS NULL OR last_message_at <= NEW.created_at);
  RETURN NEW;
END
$$;
REVOKE ALL ON FUNCTION public.zeon_dm_update_thread_summary() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS zeon_dm_message_summary ON public.zeon_dm_messages;
CREATE TRIGGER zeon_dm_message_summary AFTER INSERT ON public.zeon_dm_messages
FOR EACH ROW EXECUTE FUNCTION public.zeon_dm_update_thread_summary();

NOTIFY pgrst,'reload schema';
COMMIT;
