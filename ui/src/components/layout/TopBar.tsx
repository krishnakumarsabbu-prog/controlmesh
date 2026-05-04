import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Bell, ShieldCheck, ShieldAlert, Activity, Settings } from 'lucide-react';
import { useFleet } from '../../hooks/useFleet';
import { useAppStore } from '../store/appStore';

interface TopBarProps {
  pageTitle?: string;
}

export default function TopBar({ pageTitle }: TopBarProps) {
  const [now, setNow] = useState(new Date());
  const { data: fleet } = useFleet();
  const { theme, setTheme } = useAppStore();

  const toggleTheme = () => {
    setTheme(theme === 'standard' ? 'sentinel' : 'standard');
  };

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const qms = fleet?.queue_managers ?? [];
  const sourceCount = qms.filter((q) => q.role === 'source').length;
  const targetCount = qms.filter((q) => q.role === 'target').length;

  return (
    <header
      className="h-13 flex items-center justify-between px-6 py-3 shrink-0 border-b border-surface-border"
      style={{
        background: 'rgba(15, 21, 35, 0.95)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        boxShadow: '0 1px 0 rgba(255,255,255,0.04)',
      }}
    >
      {/* Left: page title + breadcrumb */}
      <div className="flex items-center gap-3">
        {/* Theme Switcher */}
        <button
          onClick={toggleTheme}
          className={`flex items-center gap-2 px-3 py-1 rounded-lg border text-xs font-bold transition-all duration-300 ${
            theme === 'sentinel'
              ? 'bg-red-900/20 border-red-500/30 text-red-400'
              : 'bg-indigo-900/20 border-indigo-500/30 text-indigo-400 hover:bg-indigo-900/40'
          }`}
        >
          {theme === 'sentinel' ? (
            <>
              <ShieldAlert className="w-3.5 h-3.5" />
              SENTINEL
            </>
          ) : (
            <>
              <ShieldCheck className="w-3.5 h-3.5" />
              STANDARD
            </>
          )}
        </button>

        <div className="h-4 w-px bg-surface-border" />

        <div className="flex items-center gap-2">
          <span className="text-text-muted text-xs font-medium">ControlMesh</span>
          <span className="text-surface-muted text-xs">/</span>
          {pageTitle && (
            <h2 className="text-sm font-semibold text-text-primary">{pageTitle}</h2>
          )}
        </div>

        <div className="h-4 w-px bg-surface-border" />

        <div className="flex items-center gap-3 text-xs text-text-muted">
          <div className="flex items-center gap-1.5">
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: '#9CA3AF' }}
            />
            <span>
              <span className="font-semibold text-text-secondary">{sourceCount}</span> source
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: '#22C55E', boxShadow: '0 0 4px rgba(34,197,94,0.6)' }}
            />
            <span>
              <span className="font-semibold text-text-secondary">{targetCount}</span> target
            </span>
          </div>
        </div>
      </div>

      {/* Right: live indicator, time, actions */}
      <div className="flex items-center gap-2">
        {/* Live indicator */}
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium"
          style={{
            background: 'rgba(34,197,94,0.08)',
            borderColor: 'rgba(34,197,94,0.2)',
            color: '#22C55E',
          }}
        >
          <span className="relative flex h-1.5 w-1.5">
            <span
              className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping"
              style={{ background: '#22C55E' }}
            />
            <span
              className="relative inline-flex rounded-full h-1.5 w-1.5"
              style={{ background: '#22C55E' }}
            />
          </span>
          <Activity className="w-3 h-3" />
          <span>Live</span>
        </div>

        <div className="h-4 w-px bg-surface-border" />

        {/* Clock */}
        <div className="text-xs text-text-muted font-mono tabular-nums px-2 py-1 rounded-lg bg-surface-card border border-surface-border">
          {format(now, 'HH:mm:ss')}
        </div>

        {/* Action icons */}
        <button className="w-7 h-7 flex items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-overlay border border-transparent hover:border-surface-border transition-all duration-150">
          <Bell className="w-3.5 h-3.5" />
        </button>
        <button className="w-7 h-7 flex items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-overlay border border-transparent hover:border-surface-border transition-all duration-150">
          <Settings className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
}
