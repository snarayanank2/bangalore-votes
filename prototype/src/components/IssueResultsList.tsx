interface IssueResultRow {
  id: string
  title: string
  count: number
}

/**
 * §7.11 issue-vote results: horizontal bars, all forest on a gray-100 track (§4 rule 5 — rank is
 * conveyed by order/number, never by color), rank and vote share in tabular figures, issue name
 * never truncated. Shared by the ward-level results (WardIssues) and the city-wide roll-up
 * (`/data`) per §7.11 — "the same component renders both."
 */
export function IssueResultsList({ rows, ariaLabel }: { rows: IssueResultRow[]; ariaLabel: string }) {
  const maxCount = Math.max(...rows.map((row) => row.count), 1)
  return (
    <ol aria-label={ariaLabel} className="space-y-2">
      {rows.map((row, index) => (
        <li key={row.id} className="rounded-md border border-gray-300 p-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-ink">
              <span className="mr-2 font-heading font-bold tabular-nums text-forest">#{index + 1}</span>
              {row.title}
            </span>
            <span className="whitespace-nowrap font-medium tabular-nums text-ink/80">
              {row.count} {row.count === 1 ? 'vote' : 'votes'}
            </span>
          </div>
          <div className="mt-2 h-2 w-full rounded-full bg-gray-100">
            <div
              className="h-2 rounded-full bg-forest"
              style={{ width: `${(row.count / maxCount) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ol>
  )
}
