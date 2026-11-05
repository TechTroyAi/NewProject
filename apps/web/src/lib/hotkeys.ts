'use client'

import { useEffect, useRef } from 'react'

type Handler = (e: KeyboardEvent) => void

function isTyping(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  const tag = el.tagName
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    el.isContentEditable ||
    el.getAttribute('role') === 'textbox'
  )
}

/**
 * Global hotkey registry. Hotkeys are suppressed while the user is typing
 * in an input, textarea, or contenteditable (unless `allowInInput` is set).
 */
export function useHotkeys(
  map: Record<string, Handler>,
  deps: unknown[] = [],
  enabled = true,
) {
  const ref = useRef(map)
  ref.current = map
  // Read through a ref so that toggling `enabled` does not need to be
  // part of the caller's dependency array.
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!enabledRef.current) return
      if (isTyping(e.target)) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const key = e.key.toLowerCase()
      const handler = ref.current[key]
      if (handler) {
        handler(e)
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}

export const HOTKEY_HINTS = [
  { keys: '⌘K', label: 'Command palette' },
  { keys: 'Space', label: 'Turn page (reader)' },
  { keys: '← →', label: 'Prev / next page' },
  { keys: 'G', label: 'Graph view' },
  { keys: 'N', label: 'New note' },
  { keys: '?', label: 'Shortcut help' },
  { keys: '1 – 4', label: 'Rate card (quiz)' },
  { keys: 'F', label: 'Flag card' },
  { keys: 'E', label: 'Edit card' },
]
