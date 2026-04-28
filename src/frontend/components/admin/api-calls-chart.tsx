interface Bucket {
  day:   string;
  count: number;
}

const VB_W = 600;
const VB_H = 200;
const PADDING_X = 28;
const PADDING_Y = 24;

export function ApiCallsChart({ data }: { data: Bucket[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const innerW = VB_W - PADDING_X * 2;
  const innerH = VB_H - PADDING_Y * 2;
  const slot   = innerW / data.length;
  const barW   = slot * 0.6;

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-navy-200 dark:bg-navy-900 dark:ring-navy-800">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-sm font-bold text-navy-900 dark:text-white">API calls — last 7 days</h3>
        <p className="text-xs text-navy-400 dark:text-navy-500">
          {data.reduce((s, d) => s + d.count, 0)} total
        </p>
      </div>

      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
        <line
          x1={PADDING_X} y1={PADDING_Y}
          x2={PADDING_X} y2={VB_H - PADDING_Y}
          stroke="currentColor"
          className="text-navy-200 dark:text-navy-700"
          strokeWidth={1}
        />

        {data.map((d, i) => {
          const h  = (d.count / max) * innerH;
          const x  = PADDING_X + slot * i + (slot - barW) / 2;
          const y  = VB_H - PADDING_Y - h;
          const day = new Date(d.day).toLocaleDateString(undefined, { weekday: "short" });
          return (
            <g key={d.day}>
              <rect
                x={x} y={y}
                width={barW} height={h}
                rx={3}
                className="fill-orange-400 dark:fill-orange-500"
              />
              <text
                x={x + barW / 2}
                y={y - 4}
                textAnchor="middle"
                fontSize={10}
                className="fill-navy-700 dark:fill-navy-300 font-bold"
              >
                {d.count}
              </text>
              <text
                x={x + barW / 2}
                y={VB_H - PADDING_Y + 14}
                textAnchor="middle"
                fontSize={10}
                className="fill-navy-400 dark:fill-navy-500"
              >
                {day}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
