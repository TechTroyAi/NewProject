'use client'
import { create } from 'zustand'

export interface UploadTask {
  id: string
  name: string
  size: number
  type?: string
  status: 'hashing' | 'uploading' | 'processing' | 'done' | 'error'
  progress: number
  detail?: string
  error?: string
}

interface UploadState {
  open: boolean
  setOpen: (v: boolean) => void
  tasks: UploadTask[]
  add: (t: UploadTask) => void
  update: (id: string, patch: Partial<UploadTask>) => void
  clear: () => void
}

export const useUploadStore = create<UploadState>((set) => ({
  open: false,
  setOpen: (v) => set({ open: v }),
  tasks: [],
  add: (t) => set((s) => ({ tasks: [t, ...s.tasks] })),
  update: (id, patch) =>
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
  clear: () => set({ tasks: [] }),
}))
