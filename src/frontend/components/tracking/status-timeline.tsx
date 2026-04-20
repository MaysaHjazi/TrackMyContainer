import type { NormalizedEvent } from "@/backend/services/tracking/providers/types";
import type { ShipmentType } from "@prisma/client";
import { getStatusLabel, getStatusColor, formatDate, cn } from "@/lib/utils";
import { MapPin } from "lucide-react";

interface Props {
  events: NormalizedEvent[];
  type:   ShipmentType;
}

const STATUS_DOT: Record<string, string> = {
  DELIVERED:   "bg-green-500 shadow-green-200",
  DELAYED:     "bg-orange-500 shadow-orange-200",
  EXCEPTION:   "bg-red-500   shadow-red-200",
  AT_PORT:     "bg-teal-500  shadow-teal-200",
  IN_TRANSIT:  "bg-teal-400  shadow-teal-100",
  CUSTOMS_HOLD:"bg-yellow-500 shadow-yellow-200",
  DEFAULT:     "bg-navy-300  shadow-navy-100",
};

export function StatusTimeline({ events, type }: Props) {
  if (!events.length) {
    return <p className="text-sm text-navy-400 text-center py-8">No tracking events available yet.</p>;
  }

  // Reverse so newest is at top
  // (eventDate may come through as a string after JSON serialization via the Redis cache)
  const sorted = [...events].sort(
    (a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime(),
  );

  return (
    <ol className="relative space-y-0">
      {sorted.map((event, idx) => {
        const isFirst = idx === 0;
        const dotClass = STATUS_DOT[event.status] ?? STATUS_DOT.DEFAULT;

        return (
          <li key={idx} className="relative flex gap-4 pb-6 last:pb-0">
            {/* Vertical line */}
            {idx < sorted.length - 1 && (
              <div className="absolute left-3.5 top-7 bottom-0 w-px bg-navy-100"/>
            )}

            {/* Dot */}
            <div className={cn(
              "relative z-10 mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full shadow-md",
              dotClass,
              isFirst && "ring-4 ring-white",
            )}>
              {isFirst && (
                <span className="h-2.5 w-2.5 rounded-full bg-white animate-pulse"/>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className={cn(
                    "inline-block rounded-full px-2.5 py-0.5 text-xs font-bold",
                    getStatusColor(event.status),
                  )}>
                    {getStatusLabel(event.status)}
                  </span>
                  <p className="mt-1 text-sm font-medium text-navy-600 leading-snug">
                    {event.description}
                  </p>
                </div>
                <span className="flex-shrink-0 text-xs text-navy-400 whitespace-nowrap">
                  {formatDate(event.eventDate, "MMM d, HH:mm")}
                </span>
              </div>

              {event.location && (
                <div className="mt-1 flex items-center gap-1 text-xs text-navy-400">
                  <MapPin size={10}/>
                  <span>{event.location}</span>
                </div>
              )}

              {isFirst && (
                <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-navy-50 px-2 py-0.5 text-xs text-navy-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-teal-400 animate-pulse"/>
                  Current status
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
