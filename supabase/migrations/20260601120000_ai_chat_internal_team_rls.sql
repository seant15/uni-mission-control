-- Restrict AI chat tables to internal team (exclude client / client_user roles).

CREATE OR REPLACE FUNCTION is_internal_team_user()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM app_users
    WHERE auth_user_id = auth.uid()
      AND is_active = true
      AND role NOT IN ('client', 'client_user')
  );
$$;

DROP POLICY IF EXISTS "ai_conversations_user_select" ON ai_conversations;
CREATE POLICY "ai_conversations_user_select" ON ai_conversations
  FOR SELECT USING (
    is_super_admin()
    OR (user_id = auth.uid() AND is_internal_team_user())
  );

DROP POLICY IF EXISTS "ai_conversations_user_insert" ON ai_conversations;
CREATE POLICY "ai_conversations_user_insert" ON ai_conversations
  FOR INSERT WITH CHECK (user_id = auth.uid() AND is_internal_team_user());

DROP POLICY IF EXISTS "ai_conversations_user_update" ON ai_conversations;
CREATE POLICY "ai_conversations_user_update" ON ai_conversations
  FOR UPDATE USING (user_id = auth.uid() AND is_internal_team_user());

DROP POLICY IF EXISTS "ai_messages_user_select" ON ai_messages;
CREATE POLICY "ai_messages_user_select" ON ai_messages
  FOR SELECT USING (
    is_super_admin() OR (
      is_internal_team_user() AND
      EXISTS (
        SELECT 1 FROM ai_conversations c
        WHERE c.id = ai_messages.conversation_id
          AND c.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "ai_messages_user_insert" ON ai_messages;
CREATE POLICY "ai_messages_user_insert" ON ai_messages
  FOR INSERT WITH CHECK (
    is_internal_team_user() AND
    EXISTS (
      SELECT 1 FROM ai_conversations c
      WHERE c.id = ai_messages.conversation_id
        AND c.user_id = auth.uid()
    )
  );
