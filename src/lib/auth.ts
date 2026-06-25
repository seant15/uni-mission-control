import { supabase } from './supabase'

export const MIN_PASSWORD_LENGTH = 6

export type ChangePasswordResult = { ok: true } | { ok: false; error: string }

export function validatePasswordPair(password: string, confirm: string): string | null {
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
  }
  if (password !== confirm) {
    return 'Passwords do not match.'
  }
  return null
}

/** Self-service password update for the signed-in auth user. */
export async function changeOwnPassword(password: string, confirm: string): Promise<ChangePasswordResult> {
  const validationError = validatePasswordPair(password, confirm)
  if (validationError) return { ok: false, error: validationError }

  const { error } = await supabase.auth.updateUser({ password })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getSession() {
  const { data } = await supabase.auth.getSession()
  return data.session
}

export function onAuthStateChange(callback: Parameters<typeof supabase.auth.onAuthStateChange>[0]) {
  return supabase.auth.onAuthStateChange(callback)
}
