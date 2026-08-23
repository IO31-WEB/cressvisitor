"use client";

export function PdfExportButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print inline-flex items-center gap-1.5 rounded-card border border-line bg-white px-3.5 py-2 text-xs font-medium text-ink/70 hover:bg-paper transition-colors"
    >
      Export report (PDF)
    </button>
  );
}
