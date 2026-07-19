import type { ComponentPropsWithoutRef, ReactNode } from 'react'

export function PageHeading({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-neutral-500">{subtitle}</p>}
      </div>
      {actions}
    </div>
  )
}

export function Card({ children, className = '', ...rest }: ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      className={`rounded-lg border border-neutral-800 bg-neutral-900/50 ${className}`}
      {...rest}
    >
      {children}
    </div>
  )
}

type Tone = 'neutral' | 'green' | 'red' | 'amber' | 'indigo'

const TONES: Record<Tone, string> = {
  neutral: 'bg-neutral-800 text-neutral-300',
  green: 'bg-emerald-900/50 text-emerald-300',
  red: 'bg-red-900/50 text-red-300',
  amber: 'bg-amber-900/50 text-amber-300',
  indigo: 'bg-indigo-900/50 text-indigo-300',
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: Tone }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${TONES[tone]}`}>
      {children}
    </span>
  )
}

/** A monospace id chip, since Uro surfaces a lot of opaque ULIDs. */
export function IdChip({ children }: { children: ReactNode }) {
  return <span className="font-mono text-xs text-neutral-500">{children}</span>
}
