"use client";

import { create } from "zustand";
import type { AnalysisRequest, AnalysisResult, Geofence, LatLng, PropertyType } from "@/lib/types";
import { runAnalysis } from "@/lib/analysis/runAnalysis";

type Status = "idle" | "analyzing" | "ready" | "error";

type AnalysisStore = {
  status: Status;
  error: string | null;
  result: AnalysisResult | null;
  lastRequest: AnalysisRequest | null;
  submit: (params: {
    address: string;
    location: LatLng;
    propertyType: PropertyType;
    geofence: Geofence;
    dateRange: { start: string; end: string };
  }) => Promise<void>;
  reset: () => void;
};

export const useAnalysisStore = create<AnalysisStore>()((set) => ({
  status: "idle",
  error: null,
  result: null,
  lastRequest: null,

  submit: async ({ address, location, propertyType, geofence, dateRange }) => {
    set({ status: "analyzing", error: null });
    try {
      const request: AnalysisRequest = { address, location, propertyType, dateRange, geofence };
      const result = await runAnalysis(request);
      set({ status: "ready", result, lastRequest: request });
    } catch (err) {
      set({
        status: "error",
        error: err instanceof Error ? err.message : "Something went wrong generating the analysis.",
      });
    }
  },

  reset: () => set({ status: "idle", error: null, result: null, lastRequest: null }),
}));
