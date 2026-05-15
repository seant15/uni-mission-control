import { createContext, useContext, type ReactNode } from 'react'

export type UiDensityMode = 'compact' | 'comfort'

const UiDensityContext = createContext<UiDensityMode>('comfort')

export function UiDensityProvider({ value, children }: { value: UiDensityMode; children: ReactNode }) {
  return <UiDensityContext.Provider value={value}>{children}</UiDensityContext.Provider>
}

export function useUiDensity(): UiDensityMode {
  return useContext(UiDensityContext)
}

/** Section / stack vertical rhythm tied to shell density */
export function useDensitySectionClass(): string {
  const d = useUiDensity()
  return d === 'compact' ? 'space-y-3' : 'space-y-6'
}

export function useDensityCardPadding(): string {
  const d = useUiDensity()
  return d === 'compact' ? 'p-4' : 'p-6'
}

export function useDensityStackGap(): string {
  const d = useUiDensity()
  return d === 'compact' ? 'gap-2 sm:gap-2.5' : 'gap-3 sm:gap-4'
}
