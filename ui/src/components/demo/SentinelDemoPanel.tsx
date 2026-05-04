import { ShieldAlert, ShieldCheck, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useSentinel } from '../../hooks/useSentinel';

export default function SentinelDemoPanel() {
  const { status, scan, isScanning, heal, isHealing } = useSentinel();

  const issues = status?.issues || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${issues.length > 0 ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
            {issues.length > 0 ? <ShieldAlert className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
          </div>
          <div>
            <div className="text-sm font-bold text-slate-800">
              {issues.length > 0 ? `${issues.length} Drift Issues Detected` : 'Fleet in Compliance'}
            </div>
            <div className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">
              Sentinel Monitoring Active
            </div>
          </div>
        </div>
        <button
          onClick={() => scan()}
          disabled={isScanning}
          className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-medium hover:bg-slate-700 disabled:opacity-50 transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
          Scan Fleet
        </button>
      </div>

      {issues.length > 0 ? (
        <div className="space-y-2">
          {issues.map((issue: any) => (
            <div key={issue.id} className="p-3 rounded-xl border border-red-200 bg-red-50 flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-red-900">{issue.qm} / {issue.object_name}</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 bg-red-200 text-red-700 rounded uppercase">
                    {issue.severity}
                  </span>
                </div>
                <p className="text-[11px] text-red-700 mt-0.5">{issue.issue}</p>
                <div className="mt-2 flex items-center gap-2">
                   <button 
                    onClick={() => heal(issue.id)}
                    disabled={isHealing}
                    className="px-2.5 py-1 bg-red-600 text-white rounded-md text-[10px] font-bold hover:bg-red-700 transition-colors"
                   >
                     Fix Drift
                   </button>
                </div>
              </div>
            </div>
          ))}
          
          <button
            onClick={() => heal()}
            disabled={isHealing}
            className="w-full py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-900/20"
          >
            {isHealing ? 'Self-Healing in Progress...' : 'Heal All & Re-Enforce Compliance'}
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-8 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
          <CheckCircle2 className="w-8 h-8 text-emerald-400 mb-2" />
          <div className="text-sm font-semibold text-slate-600">No configuration drift detected</div>
          <p className="text-[11px] text-slate-400 mt-1 text-center max-w-[200px]">
            Run a scan to verify fleet integrity against enterprise standards.
          </p>
        </div>
      )}

      <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
        <div className="text-[10px] font-bold text-amber-800 uppercase tracking-wider mb-1">Judge's Note:</div>
        <p className="text-[11px] text-amber-700 leading-relaxed">
          The Sentinel mode demonstrates the BCL's ability to act as a <strong>Self-Healing OS</strong>. 
          When a human makes a manual change (Drift), the agent identifies it and offers autonomous correction 
          to maintain the security posture.
        </p>
      </div>
    </div>
  );
}
