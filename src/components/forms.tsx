import type { ReactNode } from 'react'

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  required,
  testid,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  required?: boolean
  testid?: string
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs text-neutral-400">{label}</span>
      <input
        data-testid={testid}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm outline-none focus:border-neutral-500"
      />
    </label>
  )
}

export function Submit({
  children,
  pending,
  disabled,
  testid,
}: {
  children: ReactNode
  pending?: boolean
  disabled?: boolean
  testid?: string
}) {
  return (
    <button
      data-testid={testid}
      type="submit"
      disabled={pending || disabled}
      className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium hover:bg-indigo-500 disabled:opacity-50"
    >
      {pending ? 'Working…' : children}
    </button>
  )
}

/** Inline result line for a mutation form: an error, or a success node. */
export function Feedback({
  error,
  success,
  testid,
}: {
  error?: string | null
  success?: ReactNode
  testid?: string
}) {
  if (error) {
    return (
      <div className="text-sm text-red-300" data-testid={testid}>
        {error}
      </div>
    )
  }
  if (success) {
    return (
      <div className="text-sm text-emerald-300" data-testid={testid}>
        {success}
      </div>
    )
  }
  return null
}
