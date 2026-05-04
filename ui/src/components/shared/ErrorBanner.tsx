import { CircleAlert as AlertCircle } from 'lucide-react';

export default function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm status-danger bg-status-danger border border-status-danger">
      <AlertCircle className="w-4 h-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
