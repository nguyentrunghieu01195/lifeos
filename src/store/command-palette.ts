import { create } from "zustand";

/**
 * Open/close state for the global ⌘K command palette. Client-side UI state
 * only (server data lives in TanStack Query) — shared by the header trigger,
 * the keyboard shortcut listener and the palette dialog itself.
 */
interface CommandPaletteState {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
}

export const useCommandPalette = create<CommandPaletteState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
  toggle: () => set((state) => ({ open: !state.open })),
}));
