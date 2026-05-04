import { ReactNode } from 'react';
import { CircleCheck as CheckCircle, Circle, Loader } from 'lucide-react';

export type SceneStatus = 'pending' | 'active' | 'done' | 'error';

interface Props {
  number: number;
  title: string;
  subtitle: string;
  status: SceneStatus;
  duration?: string;
  children?: ReactNode;
}

export default function SceneCard({ number, title, subtitle, status, duration, children }: Props) {
  const borderVar =
    status === 'active' ? '--accent-warning' :
    status === 'done'   ? '--accent-success' :
    status === 'error'  ? '--accent-danger'  :
    '--surface-border';

  const headerStyle: React.CSSProperties = {
    background: `color-mix(in srgb, var(${borderVar}) 10%, var(--surface-raised))`,
  };

  const numStyle: React.CSSProperties =
    status === 'pending'
      ? { background: 'var(--surface-muted)', color: 'var(--text-muted)' }
      : { background: `var(${borderVar})`, color: '#fff' };

  return (
    <div
      className="rounded-xl border bg-surface-card overflow-hidden transition-all duration-300"
      style={{ borderColor: `var(${borderVar})` }}
    >
      <div className="flex items-center gap-3 px-4 py-3" style={headerStyle}>
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 font-bold text-sm"
          style={numStyle}
        >
          {status === 'active' ? (
            <Loader className="w-3.5 h-3.5 animate-spin" />
          ) : status === 'done' ? (
            <CheckCircle className="w-3.5 h-3.5" />
          ) : (
            <span>{number}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-text-primary text-sm">{title}</div>
          <div className="text-xs text-text-muted">{subtitle}</div>
        </div>
        {duration && (
          <span className="text-xs text-text-muted font-mono shrink-0">{duration}</span>
        )}
        {status === 'pending' && <Circle className="w-4 h-4 text-text-muted shrink-0" />}
        {status === 'done' && <CheckCircle className="w-4 h-4 shrink-0" style={{ color: 'var(--accent-success)' }} />}
      </div>
      {children && status !== 'pending' && (
        <div className="px-4 py-3 border-t border-surface-border">{children}</div>
      )}
    </div>
  );
}
