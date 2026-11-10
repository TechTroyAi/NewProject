'use client'
import * as React from 'react'

/**
 * Register the service worker.
 *
 * It is only registered in production: a cached shell during
 * development hides the changes you just made and makes debugging
 * needlessly confusing.
 */
export function ServiceWorkerRegister() {
  React.useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

    const register = () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
        /* Offline support is a bonus — never break the app over it. */
      })
    }

    if (document.readyState === 'complete') register()
    else {
      window.addEventListener('load', register, { once: true })
      return () => window.removeEventListener('load', register)
    }
  }, [])

  return null
}
