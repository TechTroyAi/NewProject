'use client'
import * as React from 'react'
import { Toaster as SonnerToaster } from 'sonner'
import { useTheme } from '@/lib/theme'

/**
 * Global toast host.
 *
 * Sonner owns the queue and the animation; the theme is mapped onto
 * its light/dark switch so toasts follow the shelf's own palette.
 */
export function ShelfToaster() {
  const { theme } = useTheme()
  return (
    <SonnerToaster
      theme={theme === 'paper' ? 'light' : 'dark'}
      position="bottom-right"
      closeButton
      richColors
      duration={4200}
      toastOptions={{
        classNames: {
          toast: 'font-sans text-[12.5px]',
        },
      }}
    />
  )
}
