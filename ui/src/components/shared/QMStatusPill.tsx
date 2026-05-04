interface Props {
  name: string;
  reachable: boolean;
}

export default function QMStatusPill({ name, reachable }: Props) {
  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium font-mono ${
      reachable
        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
        : 'bg-red-50 text-red-600 border border-red-200'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${reachable ? 'bg-emerald-500' : 'bg-red-400'}`} />
      {name}
    </div>
  );
}
