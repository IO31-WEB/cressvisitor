export function TradeAreaLegend({ geofenceLabel }: { geofenceLabel: string }) {
  return (
    <div className="card px-4 py-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-ink/60">
      <LegendItem swatchClassName="border-2 border-dashed border-navy-900 rounded-sm" label={geofenceLabel} />
      <LegendItem
        swatchClassName="bg-accent/70 rounded-full"
        label="Visitor-party origin (size = est. party)"
      />
      <LegendItem
        swatchClassName="border-2 border-accent bg-accent/10 rounded-sm"
        label="Observed trade-area hull"
      />
      <LegendItem
        swatchClassName="border border-dashed border-ink/40 rounded-full"
        label="Distance ring — straight-line, not drive-time"
      />
    </div>
  );
}

function LegendItem({ swatchClassName, label }: { swatchClassName: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`inline-block h-3 w-3 shrink-0 ${swatchClassName}`} />
      {label}
    </span>
  );
}
