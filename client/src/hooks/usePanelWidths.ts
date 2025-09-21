import { useState, useEffect } from "react";

interface PanelWidths {
  dataExplorer: number;
  canvas: number;
  properties: number;
}

const DEFAULT_WIDTHS: PanelWidths = {
  dataExplorer: 25, // 25% of screen width
  canvas: 50,       // 50% of screen width  
  properties: 25,   // 25% of screen width (totals 100%)
};

const STORAGE_KEY = "modeler-panel-widths";

export function usePanelWidths() {
  const [widths, setWidths] = useState<PanelWidths>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Validate the stored data
        if (
          typeof parsed.dataExplorer === "number" &&
          typeof parsed.canvas === "number" &&
          typeof parsed.properties === "number" &&
          parsed.dataExplorer > 0 &&
          parsed.canvas > 0 &&
          parsed.properties > 0
        ) {
          return parsed;
        }
      }
    } catch (error) {
      console.warn("Failed to load panel widths from localStorage:", error);
    }
    return DEFAULT_WIDTHS;
  });

  const updateWidths = (newWidths: PanelWidths) => {
    setWidths(newWidths);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newWidths));
    } catch (error) {
      console.warn("Failed to save panel widths to localStorage:", error);
    }
  };

  const resetWidths = () => {
    updateWidths(DEFAULT_WIDTHS);
  };

  return {
    widths,
    updateWidths,
    resetWidths,
  };
}