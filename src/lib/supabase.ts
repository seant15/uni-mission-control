import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL
const supabaseKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY

let supabase: SupabaseClient

if (supabaseUrl && supabaseKey && !supabaseUrl.includes('placeholder')) {
  supabase = createClient(supabaseUrl, supabaseKey)
} else {
  // Create a mock client that shows errors gracefully
  console.error('❌ Supabase not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY')
  
  // Create a dummy client that returns empty data
  const mockClient = {
    from: () => ({
      select: () => Promise.resolve({ data: [], error: null }),
      insert: () => Promise.resolve({ data: null, error: null }),
      update: () => Promise.resolve({ data: null, error: null }),
      eq: () => ({ data: [], error: null }),
      order: () => ({ data: [], error: null }),
    }),
    channel: () => ({
      on: () => ({ subscribe: () => ({ unsubscribe: () => {} }) }),
    }),
  } as unknown as SupabaseClient
  
  supabase = mockClient
}

export { supabase }
