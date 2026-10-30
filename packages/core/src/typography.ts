// Browser rendering and export use the same measured font. Offline tooling has a conservative fallback.
const context = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d')
const cache = new Map<string, number>()
export function textWidth(text: string, font: number, weight: number) {
  const key = `${font}:${weight}:${text}`
  const cached = cache.get(key)
  if (cached !== undefined) return cached
  if (context) {
    context.font = `${weight} ${font}px -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif`
  }
  const width = context
    ? context.measureText(text).width
    : Array.from(text).reduce(
        (sum, c) => sum + (/[\u2e80-\uffff]/.test(c) ? font : /[MW@]/.test(c) ? font * 0.9 : font * 0.6),
        0,
      )
  if (cache.size > 12000) cache.clear()
  cache.set(key, width)
  return width
}
