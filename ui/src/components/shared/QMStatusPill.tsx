interface Props {
  name: string;
  reachable: boolean;
}

export default function QMStatusPill({ name, reachable }: Props) {
  return (
    <div
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium font-mono border"
      style={reachable ? {
        background: 'color-mix(in srgb, var(--accent-success) 12%, transparent)',
        borderColor: 'color-mix(in srgb, var(--accent-success) 35%, transparent)',
        color: 'var(--accent-success)',
      } : {
        background: 'color-mix(in srgb, var(--accent-danger) 12%, transparent)',
        borderColor: 'color-mix(in srgb, var(--accent-danger) 35%, transparent)',
        color: 'var(--accent-danger)',
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: reachable ? 'var(--accent-success)' : 'var(--accent-danger)' }}
      />
      {name}
    </div>
  );
}
