'use client'

import { createContext, useContext } from 'react'
import type { Theme } from '@shelf/shared'

export const THEME_STORAGE_KEY = 'shelf:theme'
export const ACCENT_STORAGE_KEY = 'shelf:accent'

export const ACCENTS = [
  { name: 'Iris', value: '#7c6bf5' },
  { name: 'Ember', value: '#f5a65b' },
  { name: 'Jade', value: '#3dd6c0' },
  { name: 'Rose', value: '#f26d7d' },
  { name: 'Cobalt', value: '#5b8def' },
  { name: 'Violet', value: '#b06bf5' },
]

export interface ThemeCtx {
  theme: Theme
  accent: string
  setTheme: (t: Theme) => void
  setAccent: (hex: string) => void
}

export const ThemeContext = createContext<ThemeCtx | null>(null)

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>')
  return ctx
}

export function hexToRgbTriplet(hex: string): string {
  const clean = hex.replace('#', '')
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean
  const n = parseInt(full, 16)
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`
}
