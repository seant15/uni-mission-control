import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { signIn as authSignIn, signOut as authSignOut, onAuthStateChange } from '../lib/auth'

interface AppUser {
  id: string
  auth_user_id: string
  display_name: string
  email: string
  role: 'super_admin' | 'team_member' | 'client_user'
}

interface AuthContextValue {
  session: Session | null
  user: User | null
  appUser: AppUser | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [appUser, setAppUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadAppUser(authUserId: string) {
    const { data } = await supabase
      .from('app_users')
      .select('*')
      .eq('auth_user_id', authUserId)
      .single()
    setAppUser(data || null)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setUser(data.session?.user ?? null)
      if (data.session?.user) {
        loadAppUser(data.session.user.id).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = onAuthStateChange(async (_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        await loadAppUser(session.user.id)
      } else {
        setAppUser(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signIn(email: string, password: string) {
    await authSignIn(email, password)
  }

  async function signOut() {
    await authSignOut()
  }

  return (
    <AuthContext.Provider value={{ session, user, appUser, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
