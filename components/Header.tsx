export function Header({ subtitle }: { subtitle?: string }) {
  return (
    <header className="bg-navy-950 text-white">
      <div className="mx-auto max-w-7xl px-6 py-5 flex items-center justify-between">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-semibold tracking-tight">CRESSOLUTIONS</span>
            <span className="text-xs uppercase tracking-[0.18em] text-white/50">
              Location Intelligence
            </span>
          </div>
          {subtitle && <p className="mt-1 text-sm text-white/60">{subtitle}</p>}
        </div>
        <div className="hidden sm:flex items-center gap-2 text-xs text-white/50">
          <span className="h-1.5 w-1.5 rounded-full bg-good" />
          Synthetic data mode
        </div>
      </div>
    </header>
  );
}
