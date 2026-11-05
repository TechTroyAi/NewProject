'use client'
import { create } from 'zustand'

interface UiState {
  /** The mobile assistant sheet (the bottom tab bar is too small for a panel). */
  sheetOpen: boolean
  setSheetOpen: (v: boolean) => void
  /** The swipe-up handle that opens the sheet. */
  sheetHandleVisible: boolean
  setSheetHandleVisible: (v: boolean) => void
}

export const useUiStore = create<UiState>((set) => ({
  sheetOpen: false,
  setSheetOpen: (v) => set({ sheetOpen: v }),
  sheetHandleVisible: true,
  setSheetHandleVisible: (v) => set({ sheetHandleVisible: v }),
}))
