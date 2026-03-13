import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL
const supabaseKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
    console.warn('Supabase credentials missing in environment variables. Falling back to development defaults.')
}

export const supabase = createClient(
    supabaseUrl || 'https://jcghdthijgjttmpthagj.supabase.co',
    supabaseKey || 'dev-key-placeholder',
    {
        auth: {
            lock: async (name: string, acquireTimeout: number, fn: () => Promise<any>) => {
                return await fn()
            },
        },
    }
)
