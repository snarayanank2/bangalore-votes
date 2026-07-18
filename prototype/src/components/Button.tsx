import { forwardRef, type ButtonHTMLAttributes } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'destructive'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  /** Holds the button's width and replaces the label with a spinner (§7.3) — never disables the
   *  button itself, since a loading action isn't the "genuinely unavailable" case `disabled` is
   *  reserved for. */
  loading?: boolean
  fullWidth?: boolean
}

/** Exported so a non-<button> element that must look like one (e.g. a react-router `Link` styled
 *  as a secondary action per §7.3) can reuse the exact same variant classes instead of
 *  hand-copying them. Combine with the same base layout classes this component applies below. */
export const BUTTON_VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-forest text-white border border-forest hover:bg-forest/90',
  secondary: 'bg-white text-forest border-[1.5px] border-forest hover:bg-forest-tint',
  tertiary: 'bg-transparent text-forest border border-transparent underline-offset-2 hover:underline',
  destructive: 'bg-brick text-white border border-brick hover:bg-brick/90',
}
/** Shared base shape (44px target, radius-sm, Manrope 700 16px) — pair with a variant class from
 *  `BUTTON_VARIANT_CLASSES` above for a non-<button> element. */
export const BUTTON_BASE_CLASS =
  'inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-sm px-4 py-2 font-heading text-base font-bold transition-colors'

const VARIANT_CLASSES = BUTTON_VARIANT_CLASSES

/**
 * Design-system button (§7.3) — Primary/Secondary/Tertiary/Destructive share one shape: 44px
 * min target, radius-sm, Manrope 700 16px. `disabled` is reserved for genuinely unavailable
 * actions — gated actions (flag, issue vote, register) render fully enabled and gate at tap via
 * the Register/Login modal instead (§7.8); do not pass `disabled` to hide a gated action.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', loading = false, fullWidth = false, disabled, className = '', children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`relative disabled:cursor-not-allowed disabled:border-transparent disabled:bg-gray-300 disabled:text-gray-600 ${BUTTON_BASE_CLASS} ${VARIANT_CLASSES[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      <span className={loading ? 'invisible' : 'inline-flex items-center gap-2'}>{children}</span>
      {loading && (
        <span className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
          <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
        </span>
      )}
    </button>
  )
})
