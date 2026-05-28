-- AI Chat: conversations + messages tables with RLS
-- Run: supabase db push

-- Helper: check if current auth user is super_admin
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM app_users
    WHERE auth_user_id = auth.uid()
      AND role = 'super_admin'
  );
$$;

-- Conversations table
CREATE TABLE IF NOT EXISTS ai_conversations (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title         TEXT,
  workflow_type TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  metadata      JSONB       DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS ai_conversations_user_id_idx ON ai_conversations(user_id);
CREATE INDEX IF NOT EXISTS ai_conversations_updated_at_idx ON ai_conversations(updated_at DESC);

-- Messages table
CREATE TABLE IF NOT EXISTS ai_messages (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID        NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role            TEXT        NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content         TEXT        NOT NULL,
  action_type     TEXT,
  file_url        TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  metadata        JSONB       DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS ai_messages_conversation_id_idx ON ai_messages(conversation_id);
CREATE INDEX IF NOT EXISTS ai_messages_created_at_idx ON ai_messages(created_at ASC);

-- RLS
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;

-- Conversations: users see own; super_admin sees all
CREATE POLICY "ai_conversations_user_select" ON ai_conversations
  FOR SELECT USING (user_id = auth.uid() OR is_super_admin());

CREATE POLICY "ai_conversations_user_insert" ON ai_conversations
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "ai_conversations_user_update" ON ai_conversations
  FOR UPDATE USING (user_id = auth.uid());

-- Messages: users see messages in their own conversations; super_admin sees all
CREATE POLICY "ai_messages_user_select" ON ai_messages
  FOR SELECT USING (
    is_super_admin() OR
    EXISTS (
      SELECT 1 FROM ai_conversations c
      WHERE c.id = ai_messages.conversation_id
        AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "ai_messages_user_insert" ON ai_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM ai_conversations c
      WHERE c.id = ai_messages.conversation_id
        AND c.user_id = auth.uid()
    )
  );

-- Enable Realtime for live admin view
ALTER PUBLICATION supabase_realtime ADD TABLE ai_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE ai_messages;
