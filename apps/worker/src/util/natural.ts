/**
 * Natural sort: `page2` sorts before `page10`.
 *
 * Numeric-aware and case-insensitive, so a page list taken from a zip
 * archive reads in the right order.
 */
export function naturalCompare(a: string, b: string): number {
  const ax: (string | number)[] = []
  const bx: (string | number)[] = []
  a.replace(/(\d+)|(\D+)/g, (_, d, s) => {
    ax.push(d ? Number(d) : s.toLowerCase())
    return ''
  })
  b.replace(/(\d+)|(\D+)/g, (_, d, s) => {
    bx.push(d ? Number(d) : s.toLowerCase())
    return ''
  })
  while (ax.length && bx.length) {
    const x = ax.shift()!
    const y = bx.shift()!
    if (typeof x === 'number' && typeof y === 'number') {
      if (x !== y) return x - y
    } else {
      const sx = String(x)
      const sy = String(y)
      if (sx !== sy) return sx < sy ? -1 : 1
    }
  }
  return ax.length - bx.length
}
