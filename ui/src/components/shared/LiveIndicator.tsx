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
          connected ? 'bg-emerald-500' : 'bg-slate-300'
        }`} />
      </span>
      <span className={connected ? 'text-emerald-600' : 'text-slate-400'}>
        {connected ? 'Live' : 'Connecting…'}
      </span>
    </div>
  );
}
