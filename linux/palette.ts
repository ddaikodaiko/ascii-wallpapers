// The colours of the Konsole scheme behind each scene. Claude Code's ANSI themes draw in the terminal's 16 colours, so
// over a wallpaper this palette decides how readable the chat is: a scheme's own palette (Aritim Dark, say) was made for a
// flat background, and many of its "bright" colours are dark (a bright blue of luminance 0.2 is lost over a lit lagoon).
//
// Each colour is given a hue and solved to a relative luminance, by what Claude Code's dark-ansi theme draws with it:
//   whiteBright   text, your prompt                         0.86, nearly white
//   white         inactive and subtle text, the prompt box   0.55
//   *Bright       Claude, permissions, plan mode, success…   0.40 or more: 3:1 over the brightest tenth of a scene
//   black, blackBright   backgrounds: bash output, your messages in the transcript (opaque strips with text on them)
//   red, green, blue     backgrounds too: removed and added diff lines, the selection
// and dim text (SGR 2) takes the Faint entries, kept at 0.30 or more. The scene's accent tints the greys and the strips,
// so every wallpaper reads as its own theme.
//
// `bun linux/scheme.ts <scene>` prints them as Konsole reads them; linux/konsole.sh writes them into the scheme.
import type { SCENES } from '../hooks/scenes.js'

export type Key = keyof typeof SCENES
export type Rgb = [number, number, number]

export const hex = (s: string): Rgb => {
  const m = /^#([0-9a-f]{6})$/i.exec(s)
  if (!m?.[1]) throw new Error(`not a #rrggbb colour: ${s}`)
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const lin = (c: number) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
export const lum = ([r, g, b]: Rgb) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
export const contrast = (a: Rgb, b: Rgb) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p) as [number, number]; return (x + 0.05) / (y + 0.05) }
const mix = (a: Rgb, b: Rgb, t: number): Rgb => [0, 1, 2].map(i => Math.round(a[i]! + (b[i]! - a[i]!) * t)) as Rgb

// the colour moved toward white (or black) until its luminance is `target`, never under it once rounded to whole channels
function at(c: Rgb, target: number): Rgb {
  const up = lum(c) < target, to: Rgb = up ? [255, 255, 255] : [0, 0, 0]
  // lightening, `hi` is always at or over the target; darkening, `lo` is
  let lo = 0, hi = 1
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2
    if ((lum(mix(c, to, mid)) < target) === up) lo = mid
    else hi = mid
  }
  return mix(c, to, up ? hi : lo)
}

// each scene's median colour (sampled from its render) and its accent (the film's, as in hooks/register.tsx); `lift`
// raises the coloured text over a scene whose backdrop is lighter all over
type Spec = { bg: string; acc: string; lift?: number }
export const SPECS: Record<Key, Spec> = {
  clawd: { bg: '#191411', acc: '#d97757' },
  clouds: { bg: '#3f4951', acc: '#2f7fd6', lift: 0.06 },
  honu: { bg: '#12485b', acc: '#2dd4bf' },
  koiPond: { bg: '#283e38', acc: '#ff7a59' },
  jellyfish: { bg: '#0a1d32', acc: '#ff9ad5' },
  paperBoats: { bg: '#1f454c', acc: '#f6f7f2' },
  fireflies: { bg: '#0b1615', acc: '#d6ff78' },
  moonlit: { bg: '#0f1323', acc: '#fff3d2' },
}

export type Entry = { color: Rgb; faint: Rgb; intense: Rgb }
export type Palette = { background: Entry; foreground: Entry; colors: Entry[] }

export function palette(key: Key): Palette {
  const spec = SPECS[key]
  if (!spec) throw new Error(`unknown scene "${key}": one of ${Object.keys(SPECS).join(', ')}`)
  const bg = hex(spec.bg), acc = hex(spec.acc), lift = spec.lift ?? 0
  const grey = mix(hex('#d8dde3'), acc, 0.14)
  const ink = (c: string, l: number) => at(hex(c), l + lift)
  // the backgrounds: dark, from the scene's own colour, with the text on them in view
  const strip = (l: number, tint: number) => at(mix(bg, acc, tint), l)
  const dark = strip(0.006, 0.04), strip1 = strip(0.035, 0.16)
  // a colour and its bright form; its dim form (dim coloured text) is the bright one at 62% of its light, never under 0.30
  const pair = (normal: Rgb, bright: Rgb): Entry => ({ color: normal, faint: at(bright, Math.max(0.3, lum(bright) * 0.62)), intense: bright })

  const red = pair(at(hex('#b23a3a'), 0.075), ink('#ff6f55', 0.4))
  const green = pair(at(hex('#2f7a4a'), 0.1), ink('#4fd67e', 0.45))
  const yellow = pair(ink('#d9a62a', 0.38), ink('#ffd24f', 0.62))
  const blue = pair(at(hex('#3b6fd0'), 0.14), ink('#5b9dff', 0.4))
  const magenta = pair(ink('#a75bd0', 0.2), ink('#dd88ff', 0.42))
  const cyan = pair(ink('#2aa3ad', 0.27), ink('#4fdfe0', 0.55))
  const white: Entry = { color: at(grey, 0.55), faint: at(grey, 0.32), intense: at(mix(hex('#ffffff'), acc, 0.05), 0.88) }
  const black: Entry = { color: dark, faint: dark, intense: strip1 }

  return {
    background: { color: at(bg, Math.min(lum(bg), 0.012)), faint: at(bg, Math.min(lum(bg), 0.012)), intense: at(bg, Math.min(lum(bg), 0.012)) },
    foreground: { color: at(mix(hex('#ffffff'), acc, 0.05), 0.84), faint: at(grey, 0.4), intense: at(mix(hex('#ffffff'), acc, 0.03), 0.95) },
    colors: [black, red, green, yellow, blue, magenta, cyan, white],
  }
}

// the scheme's colour sections, in Konsole's order
export function sections(key: Key): string {
  const p = palette(key)
  const out: string[] = []
  const put = (name: string, e: Entry) => {
    for (const [suffix, c] of [['', e.color], ['Faint', e.faint], ['Intense', e.intense]] as const) out.push(`[${name}${suffix}]\nColor=${c.join(',')}\n`)
  }
  put('Background', p.background)
  p.colors.forEach((e, i) => put(`Color${i}`, e))
  put('Foreground', p.foreground)
  return out.join('\n')
}
