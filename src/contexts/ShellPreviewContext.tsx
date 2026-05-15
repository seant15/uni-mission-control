import { createContext, useContext, type ReactNode } from 'react'

export type ShellPreviewContextValue = {
  previewUserId: string | null
  setPreviewUserId: (id: string | null) => void
}

const ShellPreviewContext = createContext<ShellPreviewContextValue | null>(null)

export function ShellPreviewProvider({
  children,
  value,
}: {
  children: ReactNode
  value: ShellPreviewContextValue
}) {
  return <ShellPreviewContext.Provider value={value}>{children}</ShellPreviewContext.Provider>
}

export function useShellPreview(): ShellPreviewContextValue | null {
  return useContext(ShellPreviewContext)
}
