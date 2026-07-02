import type { InvoiceRoundingSummary } from "@interface/shared";

function formatHours(hours: number) {
  return hours.toFixed(2);
}

export function InvoiceRoundingSummaryPanel({
  roundingSummary,
  className = "",
}: {
  roundingSummary: InvoiceRoundingSummary;
  className?: string;
}) {
  if (roundingSummary.employees.length === 0) return null;

  return (
    <div
      className={`rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50/70 dark:bg-amber-950/20 p-3 ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
          Admin only: rounding detail
        </p>
        <p className="text-xs text-amber-700 dark:text-amber-300 tabular-nums">
          Project rounded up: +{formatHours(roundingSummary.roundedUpHours)}h
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs mb-3">
        <div className="rounded bg-white/70 dark:bg-gray-900/30 px-2.5 py-1.5">
          <p className="text-gray-500 dark:text-gray-400">Raw hours</p>
          <p className="font-semibold tabular-nums text-gray-800 dark:text-gray-100">
            {formatHours(roundingSummary.rawHours)}
          </p>
        </div>
        <div className="rounded bg-white/70 dark:bg-gray-900/30 px-2.5 py-1.5">
          <p className="text-gray-500 dark:text-gray-400">Rounded hours</p>
          <p className="font-semibold tabular-nums text-gray-800 dark:text-gray-100">
            {formatHours(roundingSummary.roundedHours)}
          </p>
        </div>
        <div className="rounded bg-white/70 dark:bg-gray-900/30 px-2.5 py-1.5">
          <p className="text-gray-500 dark:text-gray-400">
            Added by rounding
          </p>
          <p className="font-semibold tabular-nums text-amber-700 dark:text-amber-300">
            +{formatHours(roundingSummary.roundedUpHours)}
          </p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-amber-200/80 dark:border-amber-900/60">
              <th className="text-left py-1.5 font-medium text-gray-600 dark:text-gray-400">
                Employee
              </th>
              <th className="text-right py-1.5 font-medium text-gray-600 dark:text-gray-400">
                Raw
              </th>
              <th className="text-right py-1.5 font-medium text-gray-600 dark:text-gray-400">
                Rounded
              </th>
              <th className="text-right py-1.5 font-medium text-gray-600 dark:text-gray-400">
                Added
              </th>
            </tr>
          </thead>
          <tbody>
            {roundingSummary.employees.map((employee) => (
              <tr
                key={employee.userId}
                className="border-b border-amber-100/70 dark:border-amber-900/30 last:border-0"
              >
                <td className="py-1.5 text-gray-700 dark:text-gray-300">
                  {employee.userName}
                </td>
                <td className="py-1.5 text-right tabular-nums text-gray-600 dark:text-gray-400">
                  {formatHours(employee.rawHours)}
                </td>
                <td className="py-1.5 text-right tabular-nums text-gray-700 dark:text-gray-300">
                  {formatHours(employee.roundedHours)}
                </td>
                <td className="py-1.5 text-right tabular-nums text-amber-700 dark:text-amber-300">
                  +{formatHours(employee.roundedUpHours)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
