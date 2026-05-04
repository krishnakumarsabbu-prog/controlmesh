import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';

export default function LatencySparkline({ latencies }: { latencies: number[] }) {
  if (latencies.length === 0) {
    return <div className="text-xs text-text-muted text-center">—</div>;
  }

  const data = latencies.map((v, i) => ({ i, v }));
  const max = Math.max(...latencies);
  const colorVar = max > 100 ? '--accent-warning' : '--accent-success';

  return (
    <div className="w-full h-8">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line
            type="monotone"
            dataKey="v"
            stroke={`var(${colorVar})`}
            strokeWidth={2}
            dot={{ r: 3, fill: `var(${colorVar})` }}
            isAnimationActive={false}
          />
          <Tooltip
            content={({ active, payload }) =>
              active && payload?.[0] ? (
                <div
                  className="rounded px-2 py-1 text-xs shadow border"
                  style={{
                    background: 'var(--surface-card)',
                    borderColor: 'var(--surface-border)',
                    color: 'var(--text-primary)',
                  }}
                >
                  {payload[0].value}ms
                </div>
              ) : null
            }
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
