import { createClient } from '@supabase/supabase-js'

// Try Vite env vars first, then fall back to regular env (for Node/Coolify)
const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://jcghdthijgjttmpthagj.supabase.co'
const supabaseKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjZ2hkdGhpamdqdHRtcHRoYWdqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxNTAyNjksImV4cCI6MjA4MDcyNjI2OX0.ZR3MAGLIIerWmKUv0PlYns4M7K1o00kqK0ayeqpCPeE'

export const supabase = createClient(supabaseUrl, supabaseKey)
