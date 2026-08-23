export function LoadingState() {
  return (
    <div className="card p-12 flex flex-col items-center justify-center text-center gap-3">
      <div className="h-9 w-9 rounded-full border-2 border-line border-t-accent animate-spin" />
      <p className="text-sm font-medium text-ink/70">Generating visit events & clustering visiting parties…</p>
      <p className="text-xs text-ink/40 max-w-sm">
        Simulating device pings across the selected date range, scoring co-arrival signals, and
        separating employees & delivery traffic from real visitors.
      </p>
    </div>
  );
}

export function EmptyState() {
  return (
    <div className="card p-14 flex flex-col items-center justify-center text-center gap-2">
      <div className="h-11 w-11 rounded-full bg-accent-soft flex items-center justify-center text-accent text-lg font-semibold">
        →
      </div>
      <p className="text-sm font-medium text-ink/70">No analysis yet</p>
      <p className="text-xs text-ink/40 max-w-sm">
        Enter a commercial property address above and run the analysis to see visiting-party
        clusters, exclusion filters, and the observed trade area.
      </p>
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="card p-10 flex flex-col items-center justify-center text-center gap-2 border-bad/30">
      <p className="text-sm font-medium text-bad">Analysis failed</p>
      <p className="text-xs text-ink/50 max-w-sm">{message}</p>
    </div>
  );
}
