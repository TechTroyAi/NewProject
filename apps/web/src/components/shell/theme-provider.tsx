'use client'
import * as React from 'react'
import type { Theme } from '@shelf/shared'
import { ACCENTS, ACCENT_STORAGE_KEY, ThemeContext, THEME_STORAGE_KEY, hexToRgbTriplet } from '@/lib/theme'

/** Injected before paint so there is no flash of the wrong theme. */
export const themeScript = `
(function(){
  try {
    var t = localStorage.getItem('${THEME_STORAGE_KEY}') || 'midnight';
    var a = localStorage.getItem('${ACCENT_STORAGE_KEY}') || '#7c6bf5';
    document.documentElement.setAttribute('data-theme', t);
    var hex = a.replace('#','');
    var full = hex.length === 3 ? hex.split('').map(function(c){return c+c}).join('') : hex;
    var n = parseInt(full,16);
    document.documentElement.style.setProperty('--accent', ((n>>16)&255) + ' ' + ((n>>8)&255) + ' ' + (n&255));
  } catch(e){}
})();
`

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<Theme>('midnight')
  const [accent, setAccentState] = React.useState('#7c6bf5')

  React.useEffect(() => {
    const t = (localStorage.getItem(THEME_STORAGE_KEY) as Theme) || 'midnight'
    const a = localStorage.getItem(ACCENT_STORAGE_KEY) || '#7c6bf5'
    setThemeState(t)
    setAccentState(a)
    document.documentElement.setAttribute('data-theme', t)
    document.documentElement.style.setProperty('--accent', hexToRgbTriplet(a))
  }, [])

  const setTheme = React.useCallback((t: Theme) => {
    setThemeState(t)
    localStorage.setItem(THEME_STORAGE_KEY, t)
    document.documentElement.setAttribute('data-theme', t)
  }, [])

  const setAccent = React.useCallback((hex: string) => {
    setAccentState(hex)
    localStorage.setItem(ACCENT_STORAGE_KEY, hex)
    document.documentElement.style.setProperty('--accent', hexToRgbTriplet(hex))
  }, [])

  const value = React.useMemo(
    () => ({ theme, accent, setTheme, setAccent }),
    [theme, accent, setTheme, setAccent],
  )

  return (
    <ThemeContext.Provider value={value}>
      {children}
      <ThemeSwatchRail />
    </ThemeContext.Provider>
  )
}

/** Subtle floating accent picker — pure delight, zero chrome. */
function ThemeSwatchRail() {
  const ctx = React.useContext(ThemeContext)
  if (!ctx) return null
  const [open, setOpen] = React.useState(false)
  return (
    <div className="fixed bottom-4 left-4 z-[80]">
      {open && (
        <div className="mb-2 flex animate-scale-in gap-1.5 rounded-full border border-line/12 bg-surface p-2 shadow-pop">
          {ACCENTS.map((a) => (
            <button
              key={a.value}
              title={a.name}
              onClick={() => ctx.setAccent(a.value)}
              className="size-6 rounded-full border-2 transition-transform hover:scale-110"
              style={{
                background: a.value,
                borderColor: ctx.accent === a.value ? 'rgb(var(--fg))' : 'transparent',
              }}
            />
          ))}
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        className="grid size-8 place-items-center rounded-full border border-line/12 bg-surface shadow-pop transition hover:scale-105"
        aria-label="Accent colour"
      >
        <span className="size-3.5 rounded-full" style={{ background: ctx.accent }} />
      </button>
    </div>
  )
}
