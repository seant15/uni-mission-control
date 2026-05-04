import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react'
import { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { signIn as authSignIn, signOut as authSignOut, onAuthStateChange } from '../lib/auth'

const SESSION_BOOT_TIMEOUT_MS = 12_000

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
  const bootDone = useRef(false)

  async function loadAppUser(authUserId: string) {
    try {
      const { data, error } = await supabase
        .from('app_users')
        .select('*')
        .eq('auth_user_id', authUserId)
        .single()
      if (error) {
        console.error('app_users load failed:', error.message)
        setAppUser(null)
        return
      }
      setAppUser(data || null)
    } catch (e) {
      console.error('app_users load exception:', e)
      setAppUser(null)
    }
  }

  useEffect(() => {
    bootDone.current = false
    setLoading(true)

    const finishBoot = () => {
      if (bootDone.current) return
      bootDone.current = true
      setLoading(false)
    }

    const applySession = async (next: Session | null) => {
      setSession(next)
      setUser(next?.user ?? null)
      if (next?.user) {
        await loadAppUser(next.user.id)
      } else {
        setAppUser(null)
      }
    }

    const { data: { subscription } } = onAuthStateChange(async (_event, nextSession) => {
      await applySession(nextSession)
      finishBoot()
    })

    // Cold start: some builds deliver getSession before the first auth callback; never force null on timeout.
    void supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (bootDone.current) return
      void applySession(s).then(finishBoot)
    }).catch((e) => {
      console.error('getSession failed:', e)
      finishBoot()
    })

    const safetyTimer = window.setTimeout(() => finishBoot(), SESSION_BOOT_TIMEOUT_MS)

    return () => {
      window.clearTimeout(safetyTimer)
      subscription.unsubscribe()
    }
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
