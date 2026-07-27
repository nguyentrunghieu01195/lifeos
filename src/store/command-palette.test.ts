import { beforeEach, describe, expect, it } from "vitest";

import { useCommandPalette } from "@/store/command-palette";

describe("command palette store", () => {
  beforeEach(() => {
    useCommandPalette.setState({ open: false });
  });

  it("opens and closes explicitly", () => {
    useCommandPalette.getState().setOpen(true);
    expect(useCommandPalette.getState().open).toBe(true);
    useCommandPalette.getState().setOpen(false);
    expect(useCommandPalette.getState().open).toBe(false);
  });

  it("toggles", () => {
    useCommandPalette.getState().toggle();
    expect(useCommandPalette.getState().open).toBe(true);
    useCommandPalette.getState().toggle();
    expect(useCommandPalette.getState().open).toBe(false);
  });
});
