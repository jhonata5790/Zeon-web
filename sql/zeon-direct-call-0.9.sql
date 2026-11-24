-- Zeon Direct Call 0.9. Execute uma única vez no projeto Supabase.
CREATE POLICY zeon_voice_p2p_read ON realtime.messages FOR SELECT TO authenticated
USING (extension IN ('broadcast','presence') AND EXISTS(
 SELECT 1 FROM public.channels c WHERE c.type='voice' AND realtime.topic()='zeon:voice:'||c.id::text AND private.is_group_member(c.group_id)));
CREATE POLICY zeon_voice_p2p_send ON realtime.messages FOR INSERT TO authenticated
WITH CHECK (extension IN ('broadcast','presence') AND EXISTS(
 SELECT 1 FROM public.channels c WHERE c.type='voice' AND realtime.topic()='zeon:voice:'||c.id::text AND private.is_group_member(c.group_id)));
