'use client'
import * as React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Sparkles, X } from 'lucide-react'
import { useUiStore } from '@/lib/ui-store'
import { useScopeStore } from '@/lib/scope-store'
import { AssistantChat } from './assistant-chat'

/**
 * The mobile assistant sheet.
 *
 * On a phone the right-hand panel has nowhere to live, so the
 * assistant becomes a sheet: swipe the handle at the bottom of the
 * screen up to open it, swipe it down to close it.
 */
export function MobileSheet() {
  const { sheetOpen, setSheetOpen, sheetHandleVisible, setSheetHandleVisible } = useUiStore()
  const { context, setScope } = useScopeStore()

  // The sheet is a phone affordance; hide it when the layout is wide
  // enough for the panel.
  React.useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const sync = () => {
      if (mq.matches) {
        setSheetOpen(false)
        setSheetHandleVisible(false)
      } else {
        setSheetHandleVisible(true)
      }
    }
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [setSheetOpen, setSheetHandleVisible])

  React.useEffect(() => {
    if (!sheetOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSheetOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sheetOpen, setSheetOpen])

  return (
    <>
      {/* Swipe-up handle — sits above the bottom tab bar */}
      <AnimatePresence>
        {sheetHandleVisible && !sheetOpen && (
          // The button is centred by its wrapper; framer-motion owns the
          // button's transform, so the centring cannot live on it.
          <div className="fixed inset-x-0 bottom-[70px] z-40 flex justify-center md:hidden">
            <motion.button
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              onClick={() => setSheetOpen(true)}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.4 }}
              onDragEnd={(_, info) => {
                if (info.offset.y < -30 || info.velocity.y < -400) setSheetOpen(true)
              }}
              className="flex touch-none flex-col items-center gap-1 rounded-full border border-line/12 bg-surface/95 px-4 py-2 shadow-pop backdrop-blur"
              aria-label="Open assistant"
            >
              <span className="h-1 w-8 rounded-full bg-line/25" />
              <span className="flex items-center gap-1.5 text-[11.5px] text-muted">
                <Sparkles className="size-3 text-accent" />
                Assistant
              </span>
            </motion.button>
          </div>
        )}
      </AnimatePresence>

      {/* The sheet */}
      <AnimatePresence>
        {sheetOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSheetOpen(false)}
              className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px] md:hidden"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 34 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.55 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 110 || info.velocity.y > 520) setSheetOpen(false)
              }}
              role="dialog"
              aria-label="Assistant"
              className="fixed inset-x-0 bottom-0 top-[14%] z-50 flex flex-col rounded-t-2xl border-t border-line/12 bg-surface shadow-pop md:hidden"
            >
              <div className="flex items-center gap-2 border-b border-line/8 px-4 py-3">
                <span className="h-1 w-9 rounded-full bg-line/25" />
                <span className="flex-1" />
                <span className="text-[12px] font-semibold">Assistant</span>
                <span className="flex-1" />
                <button
                  onClick={() => setSheetOpen(false)}
                  className="grid size-7 place-items-center rounded-lg text-faint transition hover:bg-raised hover:text-fg"
                  aria-label="Close assistant"
                >
                  <X className="size-4" />
                </button>
              </div>

              {context.length > 0 && (
                <div className="flex flex-wrap gap-1.5 border-b border-line/8 px-4 py-2">
                  {context.map((c, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 rounded-lg border border-line/12 bg-raised px-1.5 py-0.5 text-[11px] text-muted"
                    >
                      {c.label}
                    </span>
                  ))}
                  <button
                    onClick={() => setScope({ mode: 'vault' })}
                    className="rounded-lg border border-line/12 px-1.5 py-0.5 text-[11px] text-faint"
                  >
                    clear scope
                  </button>
                </div>
              )}

              <AssistantChat />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
