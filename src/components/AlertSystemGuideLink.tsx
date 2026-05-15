import { Sparkles, ExternalLink } from 'lucide-react'

const viteEnv = import.meta as ImportMeta & { env: { BASE_URL: string } }
const guideHref = new URL('alert-system-guide.html', viteEnv.env.BASE_URL).href

type Variant = 'rail' | 'page'

/**
 * Opens the static alert architecture guide (`/alert-system-guide.html`) in a new tab.
 */
export default function AlertSystemGuideLink({ variant = 'page' }: { variant?: Variant }) {
  const isRail = variant === 'rail'

  return (
    <a
      href={guideHref}
      target="_blank"
      rel="noopener noreferrer"
      className={[
        'group relative isolate flex items-center justify-center gap-2 overflow-hidden rounded-xl font-semibold tracking-tight',
        'text-white bg-gradient-to-br from-[var(--brand-600)] via-[var(--brand-500)] to-orange-500',
        'shadow-[0_4px_18px_-4px_color-mix(in_oklab,var(--brand-500)_55%,transparent)]',
        'hover:shadow-[0_8px_28px_-6px_color-mix(in_oklab,var(--brand-500)_65%,transparent)] hover:brightness-[1.04]',
        'active:scale-[0.98] transition duration-200 ease-out',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-600)]',
        'motion-reduce:transition-none motion-reduce:hover:brightness-100',
        isRail ? 'w-full px-2.5 py-2 text-[11px] leading-tight' : 'shrink-0 px-4 py-2.5 text-sm',
      ].join(' ')}
    >
      <span
        className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full motion-reduce:hidden"
        aria-hidden
      />
      <Sparkles
        size={isRail ? 14 : 16}
        className="relative shrink-0 opacity-95 drop-shadow-sm group-hover:rotate-6 transition-transform duration-200 motion-reduce:group-hover:rotate-0"
        aria-hidden
      />
      <span className="relative text-left leading-snug">
        {isRail ? (
          <>
            Alert system <span className="whitespace-nowrap">guide</span>
          </>
        ) : (
          <>Alert system guide</>
        )}
        <span className="block font-normal opacity-90 text-[10px] sm:text-[11px] normal-case tracking-normal">
          Setup · learn · collaborate
        </span>
      </span>
      <ExternalLink size={isRail ? 12 : 14} className="relative shrink-0 opacity-90" aria-hidden />
    </a>
  )
}
