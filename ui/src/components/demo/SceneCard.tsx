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
  const borderClass =
    status === 'active' ? 'border-amber-300 shadow-amber-50 shadow-md' :
    status === 'done'   ? 'border-emerald-200' :
    status === 'error'  ? 'border-red-200' :
    'border-slate-200';

  const headerBg =
    status === 'active' ? 'bg-amber-50' :
    status === 'done'   ? 'bg-emerald-50' :
    status === 'error'  ? 'bg-red-50' :
    'bg-slate-50';

  const numClass =
    status === 'active' ? 'bg-amber-500 text-white' :
    status === 'done'   ? 'bg-emerald-500 text-white' :
    status === 'error'  ? 'bg-red-500 text-white' :
    'bg-slate-200 text-slate-500';

  return (
    <div className={`rounded-xl border bg-white overflow-hidden transition-all duration-300 ${borderClass}`}>
      <div className={`flex items-center gap-3 px-4 py-3 ${headerBg}`}>
        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 font-bold text-sm ${numClass}`}>
          {status === 'active' ? (
            <Loader className="w-3.5 h-3.5 animate-spin" />
          ) : status === 'done' ? (
            <CheckCircle className="w-3.5 h-3.5" />
          ) : (
            <span>{number}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-slate-800 text-sm">{title}</div>
          <div className="text-xs text-slate-500">{subtitle}</div>
        </div>
        {duration && (
          <span className="text-xs text-slate-400 font-mono shrink-0">{duration}</span>
        )}
        {status === 'pending' && <Circle className="w-4 h-4 text-slate-300 shrink-0" />}
        {status === 'done' && <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />}
      </div>
      {children && status !== 'pending' && (
        <div className="px-4 py-3 border-t border-slate-100">{children}</div>
      )}
    </div>
  );
}
