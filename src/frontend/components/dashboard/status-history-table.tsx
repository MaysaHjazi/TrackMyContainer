import { formatDate, getStatusLabel, getStatusColor } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { ShipmentStatus } from "@prisma/client";

interface TrackingEvent {
  id: string;
  status: ShipmentStatus;
  location: string | null;
  description: string;
  eventDate: Date | string;
  source: string;
}

interface Props {
  events: TrackingEvent[];
}

export function StatusHistoryTable({ events }: Props) {
  if (events.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-navy-400 dark:text-navy-500">
        No tracking events yet
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-navy-200 dark:border-navy-700">
            <th className="py-2 px-3 text-left text-xs font-semibold uppercase tracking-wider text-navy-400 dark:text-navy-500">Date</th>
            <th className="py-2 px-3 text-left text-xs font-semibold uppercase tracking-wider text-navy-400 dark:text-navy-500">Status</th>
            <th className="py-2 px-3 text-left text-xs font-semibold uppercase tracking-wider text-navy-400 dark:text-navy-500">Location</th>
            <th className="py-2 px-3 text-left text-xs font-semibold uppercase tracking-wider text-navy-400 dark:text-navy-500">Description</th>
            <th className="py-2 px-3 text-left text-xs font-semibold uppercase tracking-wider text-navy-400 dark:text-navy-500">Source</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-navy-100 dark:divide-navy-800">
          {events.map((event) => (
            <tr key={event.id} className="hover:bg-navy-50 dark:hover:bg-navy-800/50 transition-colors">
              <td className="py-2.5 px-3 whitespace-nowrap text-navy-600 dark:text-navy-300">
                {formatDate(event.eventDate, "MMM d, HH:mm")}
              </td>
              <td className="py-2.5 px-3">
                <span className={cn(
                  "inline-flex rounded-full px-2 py-0.5 text-xs font-bold",
                  getStatusColor(event.status)
                )}>
                  {getStatusLabel(event.status)}
                </span>
              </td>
              <td className="py-2.5 px-3 text-navy-600 dark:text-navy-300">
                {event.location || "—"}
              </td>
              <td className="py-2.5 px-3 text-navy-500 dark:text-navy-400 max-w-xs truncate">
                {event.description}
              </td>
              <td className="py-2.5 px-3 text-navy-400 dark:text-navy-500 capitalize text-xs">
                {event.source}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
