import { CheckCircle2, AlertTriangle, AlertCircle, Activity } from "lucide-react";
import { cn, relativeDate } from "@/lib/utils";

interface ActivityItem {
  id:         string;
  type:       string;
  level:      string;
  message:    string;
  createdAt:  Date;
  user?:      { email: string; name: string | null } | null;
}

function levelMeta(level: string) {
  if (level === "error")   return { Icon: AlertCircle,    color: "text-red-500" };
  if (level === "warning") return { Icon: AlertTriangle,  color: "text-orange-500" };
  return                   { Icon: CheckCircle2,          color: "text-teal-500" };
}

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center py-10 text-center">
        <Activity size={28} className="text-navy-300 dark:text-navy-600" />
        <p className="mt-2 text-sm text-navy-500 dark:text-navy-400">
          No activity yet. Events will appear as they happen.
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-navy-100 dark:divide-navy-800">
      {items.map((item) => {
        const { Icon, color } = levelMeta(item.level);
        return (
          <li key={item.id} className="flex items-start gap-3 py-3">
            <Icon size={16} className={cn("mt-0.5 flex-shrink-0", color)} />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-navy-900 dark:text-white">
                <span className="font-mono text-xs text-navy-500 dark:text-navy-400 mr-1.5">
                  {item.type}
                </span>
                {item.message}
              </p>
              <p className="mt-0.5 text-xs text-navy-400 dark:text-navy-500">
                {item.user?.email ?? "system"} · {relativeDate(item.createdAt)}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
