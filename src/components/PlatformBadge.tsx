import { platformBadgeClass, platformShortLabel } from '../lib/platformStyles'

export default function PlatformBadge({
  platform,
  className = '',
}: {
  platform: string | null | undefined
  className?: string
}) {
  if (!platform) return null
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap ${platformBadgeClass(platform)} ${className}`}
    >
      {platformShortLabel(platform)}
    </span>
  )
}
