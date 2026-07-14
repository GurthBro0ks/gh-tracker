import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type CopyState = "idle" | "copied" | "failed";

const state = vi.hoisted(() => ({
  value: "idle" as CopyState,
  set: vi.fn((next: CopyState) => {
    state.value = next;
  }),
}));

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useState: () => [state.value, state.set],
}));

import { CopyControl } from "../_components/copy-control";

type CopyButton = ReactElement<{
  "aria-live": string;
  children: ReactNode;
  onClick: () => Promise<void>;
}>;

const writeText = vi.fn<(value: string) => Promise<void>>();

function renderControl(): CopyButton {
  return CopyControl({ label: "Copy continuation", value: "fixture text" }) as CopyButton;
}

describe("CopyControl", () => {
  beforeEach(() => {
    state.value = "idle";
    state.set.mockClear();
    writeText.mockReset();
    vi.useFakeTimers();
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    vi.stubGlobal("window", { setTimeout });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("announces successful copy and returns to idle", async () => {
    writeText.mockResolvedValue(undefined);

    await renderControl().props.onClick();

    expect(renderControl().props.children).toBe("Copied");
    expect(renderControl().props["aria-live"]).toBe("polite");
    vi.runAllTimers();
    expect(renderControl().props.children).toBe("Copy continuation");
  });

  it("announces copy failure and allows a successful retry", async () => {
    writeText.mockRejectedValueOnce(new Error("clipboard unavailable"));

    await renderControl().props.onClick();

    expect(renderControl().props.children).toBe("Copy failed");
    expect(renderControl().props["aria-live"]).toBe("polite");

    writeText.mockResolvedValueOnce(undefined);
    await renderControl().props.onClick();
    expect(renderControl().props.children).toBe("Copied");
    expect(writeText).toHaveBeenCalledTimes(2);
  });
});
