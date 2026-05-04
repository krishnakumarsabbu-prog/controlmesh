import { useAppStore } from '../../store/appStore';

export default function LiveIndicator() {
  const connected = useAppStore((s) => s.sseConnected);

  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className={`relative flex w-2 h-2`}>
        {connected && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        )}
        <span className={`relative inline-flex rounded-full w-2 h-2 ${
          connected ? 'bg-accent-emerald' : 'bg-surface-muted'
        }`} />
      </span>
      <span className={connected ? 'text-accent-emerald' : 'text-text-muted'}>
        {connected ? 'Live' : 'Connecting…'}
      </span>
    </div>
  );
}
