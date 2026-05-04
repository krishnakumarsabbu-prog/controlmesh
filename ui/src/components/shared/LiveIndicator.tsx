import { useAppStore } from '../../store/appStore';

export default function LiveIndicator() {
  const connected = useAppStore((s) => s.sseConnected);

  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className="relative flex w-2 h-2">
        {connected && (
          <span
            className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
            style={{ background: 'var(--accent-success)' }}
          />
        )}
        <span
          className="relative inline-flex rounded-full w-2 h-2"
          style={{ background: connected ? 'var(--accent-success)' : 'var(--surface-muted)' }}
        />
      </span>
      <span style={{ color: connected ? 'var(--accent-success)' : 'var(--text-muted)' }}>
        {connected ? 'Live' : 'Connecting…'}
      </span>
    </div>
  );
}
