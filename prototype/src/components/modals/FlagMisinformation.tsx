import { useEffect, useState, type FormEvent } from 'react'
import { Modal } from '../Modal'
import { Button } from '../Button'
import { useAuth } from '../../context/AuthContext'
import { useData } from '../../context/DataContext'
import type { FlagContext } from '../../context/ModalContext'

const INPUT_CLASS =
  'min-h-[44px] w-full rounded-sm border border-gray-300 px-3 py-2 text-base text-ink focus:border-forest'

interface FlagMisinformationProps {
  open: boolean
  ctx: FlagContext | null
  onClose: () => void
}

/**
 * Flag-misinformation modal (IA §7.2). Works across ANY ward, not just the visitor's home ward —
 * `ctx.wardId` is whatever ward the triggering page was on.
 *
 * Only ever opened via a gated trigger (`GatedButton`), so by the time this is visible the user
 * is authenticated — either immediately, or after the Register/Login modal resumes this one in
 * place via `useAuth().resolvePending()` (see ModalContext / GatedButton).
 */
export function FlagMisinformation({ open, ctx, onClose }: FlagMisinformationProps) {
  const { user } = useAuth()
  const { submitFlag } = useData()

  const [fieldKey, setFieldKey] = useState('')
  const [detail, setDetail] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  // Reset the form each time a fresh flag context opens.
  useEffect(() => {
    if (open) {
      setFieldKey(ctx?.fields[0]?.key ?? '')
      setDetail('')
      setSourceUrl('')
      setError(null)
      setSubmitted(false)
    }
  }, [open, ctx])

  const fields = ctx?.fields ?? []

  function handleSubmit(event: FormEvent): void {
    event.preventDefault()
    if (!ctx) return
    if (!fieldKey) {
      setError('Select which field is wrong.')
      return
    }
    if (!detail.trim()) {
      setError('Describe what is wrong.')
      return
    }
    try {
      submitFlag(
        {
          wardId: ctx.wardId,
          candidateId: ctx.candidateId,
          field: fieldKey,
          detail: detail.trim(),
          sourceUrl: sourceUrl.trim() || undefined,
        },
        user,
      )
      setError(null)
      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit this flag.')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Flag misinformation">
      {error && (
        <p role="alert" className="mb-3 rounded-md bg-brick-tint px-3 py-2 text-sm text-brick">
          {error}
        </p>
      )}
      {submitted ? (
        <div className="space-y-3">
          <p className="text-sm text-ink">
            Thanks — this has been sent to the curator responsible for this ward.
          </p>
          <Button type="button" onClick={onClose} fullWidth>
            Close
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label htmlFor="flag-field" className="mb-1 block text-sm font-medium text-ink">
              What&apos;s wrong?
            </label>
            <select
              id="flag-field"
              value={fieldKey}
              onChange={(e) => setFieldKey(e.target.value)}
              className={INPUT_CLASS}
            >
              {fields.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="flag-detail" className="mb-1 block text-sm font-medium text-ink">
              Detail
            </label>
            <textarea
              id="flag-detail"
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              rows={3}
              className={INPUT_CLASS}
              placeholder="What's incorrect, and what should it say instead?"
            />
          </div>
          <div>
            <label htmlFor="flag-source" className="mb-1 block text-sm font-medium text-ink">
              Source URL (optional)
            </label>
            <input
              id="flag-source"
              type="text"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              className={INPUT_CLASS}
              placeholder="https://…"
            />
          </div>
          <Button type="submit" fullWidth>
            Submit
          </Button>
        </form>
      )}
    </Modal>
  )
}
