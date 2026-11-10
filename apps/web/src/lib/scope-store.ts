'use client'
import { create } from 'zustand'
import type { ChatScope } from '@shelf/shared'

interface ScopeState {
  scope: ChatScope
  setScope: (s: Partial<ChatScope>) => void
  panelOpen: boolean
  setPanelOpen: (v: boolean) => void
  context: { label: string; kind: 'note' | 'item' | 'series' }[]
  setContext: (c: { label: string; kind: 'note' | 'item' | 'series' }[]) => void
}

export const useScopeStore = create<ScopeState>((set) => ({
  scope: { mode: 'vault' },
  setScope: (s) => set((prev) => ({ scope: { ...prev.scope, ...s } })),
  panelOpen: true,
  setPanelOpen: (v) => set({ panelOpen: v }),
  context: [],
  setContext: (context) => set({ context }),
}))
