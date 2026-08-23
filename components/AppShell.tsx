"use client";

import { Header } from "@/components/Header";
import { AddressSearch } from "@/components/AddressSearch";
import { ResultsPanel } from "@/components/ResultsPanel";
import { LoadingState, EmptyState, ErrorState } from "@/components/StateViews";
import { useAnalysisStore } from "@/store/useAnalysisStore";

export function AppShell() {
  const status = useAnalysisStore((s) => s.status);
  const result = useAnalysisStore((s) => s.result);
  const error = useAnalysisStore((s) => s.error);

  return (
    <div className="min-h-screen">
      <Header subtitle="Geofenced visit analytics & observed trade area" />
      <main className="mx-auto max-w-7xl px-6 py-8 space-y-6">
        <AddressSearch />

        {status === "analyzing" && <LoadingState />}
        {status === "error" && error && <ErrorState message={error} />}
        {status === "ready" && result && <ResultsPanel result={result} />}
        {status === "idle" && <EmptyState />}
      </main>
    </div>
  );
}
