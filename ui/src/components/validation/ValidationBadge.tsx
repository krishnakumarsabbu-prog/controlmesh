import { Check, X, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import type { ValidationResult } from '../../types';

export default function ValidationBadge({ result }: { result?: ValidationResult }) {
  if (!result) {
    return (
      <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100">
        <Clock className="w-3.5 h-3.5 text-slate-300" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="inline-flex flex-col items-center gap-0.5"
    >
      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
        result.passed ? 'bg-emerald-100' : 'bg-red-100'
      }`}>
        {result.passed
          ? <Check className="w-4 h-4 text-emerald-600" />
          : <X className="w-4 h-4 text-red-500" />
        }
      </div>
      <span className={`text-[10px] font-medium tabular-nums ${
        result.passed ? 'text-emerald-600' : 'text-red-500'
      }`}>
        {result.latency_ms}ms
      </span>
    </motion.div>
  );
}
