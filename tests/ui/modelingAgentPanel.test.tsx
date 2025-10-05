import React from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { ModelingAgentPanel } from "@/components/ModelingAgentPanel";

// Radix UI relies on ResizeObserver which isn't available in jsdom by default.
beforeAll(() => {
  if (!(globalThis as any).ResizeObserver) {
    class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    (globalThis as any).ResizeObserver = ResizeObserver;
  }

  if (!(globalThis as any).matchMedia) {
    (globalThis as any).matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  }
});

describe("ModelingAgentPanel", () => {
  it("renders without triggering repeated state updates when opened", () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    const { getByText } = render(
      <QueryClientProvider client={queryClient}>
        <ModelingAgentPanel open={true} onOpenChange={() => {}} />
      </QueryClientProvider>
    );

    expect(getByText("Integrative AI Modeling Agent")).toBeTruthy();
  });
});
