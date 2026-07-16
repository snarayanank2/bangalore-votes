import { useAuth } from '../../context/AuthContext'
import { useData, useStoreVersion } from '../../context/DataContext'
import { DEFAULT_NOTIFICATION_PREFS } from '../../store/store'
import type { NotificationPrefs } from '../../types'

interface ToggleRowProps {
  id: string
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}

function ToggleRow({ id, label, checked, onChange }: ToggleRowProps) {
  return (
    <label
      htmlFor={id}
      className="flex items-center justify-between gap-3 rounded border border-slate-200 px-3 py-2 text-sm"
    >
      <span className="text-ink">{label}</span>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4"
      />
    </label>
  )
}

/**
 * Notification settings (PRD §9, IA §4.2, `/account/notifications`). Registered-only.
 *
 * HONESTY: this is a static prototype — no email or WhatsApp message is ever actually sent from
 * here. Every toggle only records a preference in the local store; a banner says so up front so
 * nothing here implies real delivery.
 *
 * Each toggle applies immediately (no separate Save step), mirroring WardResult's "Set as my
 * ward" button and CastIssueVote's instantly-persisted vote — consistent with the rest of the
 * app's pattern of publishing/recording an action as soon as it's taken, not staging it.
 */
export default function Notifications() {
  const { user } = useAuth()
  const data = useData()
  useStoreVersion() // re-render after setNotificationPrefs mutates this user

  const prefs: NotificationPrefs = user.notificationPrefs ?? DEFAULT_NOTIFICATION_PREFS

  function update(patch: Partial<NotificationPrefs>): void {
    data.setNotificationPrefs(user.id, {
      ...prefs,
      ...patch,
      subscriptions: { ...prefs.subscriptions, ...patch.subscriptions },
    })
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">Notification settings</h1>
        <p className="mt-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Simulated only — this prototype never sends a real email or WhatsApp message. Toggles
          below just record your preference.
        </p>
      </div>

      <section aria-labelledby="channels-heading" className="space-y-3">
        <h2 id="channels-heading" className="text-lg font-semibold text-ink">
          Channels
        </h2>
        <div className="space-y-2">
          <ToggleRow
            id="notif-email"
            label="Email updates"
            checked={prefs.emailEnabled}
            onChange={(checked) => update({ emailEnabled: checked })}
          />
          <ToggleRow
            id="notif-whatsapp"
            label="WhatsApp updates"
            checked={prefs.whatsappEnabled}
            onChange={(checked) => update({ whatsappEnabled: checked })}
          />
        </div>
      </section>

      <section aria-labelledby="subscriptions-heading" className="space-y-3 border-t border-slate-200 pt-6">
        <h2 id="subscriptions-heading" className="text-lg font-semibold text-ink">
          Ward updates
        </h2>
        <div className="space-y-2">
          <ToggleRow
            id="notif-election-notice"
            label="Election date & official notice updates"
            checked={prefs.subscriptions.electionNotice}
            onChange={(checked) =>
              update({ subscriptions: { ...prefs.subscriptions, electionNotice: checked } })
            }
          />
          <ToggleRow
            id="notif-roll-deadlines"
            label="Voter roll deadline reminders"
            checked={prefs.subscriptions.rollDeadlines}
            onChange={(checked) =>
              update({ subscriptions: { ...prefs.subscriptions, rollDeadlines: checked } })
            }
          />
          <ToggleRow
            id="notif-candidate-changes"
            label="Candidate profile changes in your ward"
            checked={prefs.subscriptions.candidateChanges}
            onChange={(checked) =>
              update({ subscriptions: { ...prefs.subscriptions, candidateChanges: checked } })
            }
          />
        </div>
      </section>
    </div>
  )
}
