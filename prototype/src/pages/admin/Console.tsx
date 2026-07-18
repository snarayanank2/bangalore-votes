import { Link } from 'react-router-dom'
import { useData, useStoreVersion } from '../../context/DataContext'

/**
 * Admin console (PRD §7, IA §6.1, `/admin`) — governance home base. Admin-only
 * (`RoleGuard allow={['admin']}` in routes.tsx). Links into the three admin pages plus a couple of
 * at-a-glance counts so an admin logging in immediately sees the scale of what they're governing.
 */
export default function Console() {
  const data = useData()
  useStoreVersion()

  const users = data.listUsers()
  const curatorCount = users.filter((u) => u.role === 'curator').length
  const auditCount = data.listAudit().length

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-8">
      <div>
        <h1 className="text-2xl text-ink sm:text-3xl">Admin console</h1>
        <p className="mt-1 text-sm text-ink/70">City-wide governance — roles, users, and the audit trail.</p>
      </div>

      <dl className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-md border border-gray-300 p-4">
          <dt className="text-sm text-gray-600">Users</dt>
          <dd className="mt-1 text-2xl text-ink">{users.length}</dd>
        </div>
        <div className="rounded-md border border-gray-300 p-4">
          <dt className="text-sm text-gray-600">Curators</dt>
          <dd className="mt-1 text-2xl text-ink">{curatorCount}</dd>
        </div>
        <div className="rounded-md border border-gray-300 p-4">
          <dt className="text-sm text-gray-600">Audit entries</dt>
          <dd className="mt-1 text-2xl text-ink">{auditCount}</dd>
        </div>
      </dl>

      <nav aria-label="Admin pages" className="space-y-3">
        <Link
          to="/admin/roles"
          className="block rounded-md border border-forest bg-forest-tint p-4 hover:bg-forest-tint/70"
        >
          <p className="font-semibold text-ink">Roles &amp; access</p>
          <p className="text-sm text-ink/70">Grant or revoke the curator role and set ward scope.</p>
        </Link>
        <Link
          to="/admin/users"
          className="block rounded-md border border-gray-300 p-4 hover:border-forest"
        >
          <p className="font-semibold text-ink">Users</p>
          <p className="text-sm text-ink/70">Search accounts, deactivate/reactivate, view submission history.</p>
        </Link>
        <Link
          to="/admin/partners"
          className="block rounded-md border border-gray-300 p-4 hover:border-forest"
        >
          <p className="font-semibold text-ink">Partners &amp; ward coverage</p>
          <p className="text-sm text-ink/70">
            Partner reach against every ward, expressions of interest, and held wards.
          </p>
        </Link>
        <Link
          to="/admin/audit"
          className="block rounded-md border border-gray-300 p-4 hover:border-forest"
        >
          <p className="font-semibold text-ink">Audit log</p>
          <p className="text-sm text-ink/70">The full immutable record of published changes and admin actions.</p>
        </Link>
      </nav>
    </div>
  )
}
