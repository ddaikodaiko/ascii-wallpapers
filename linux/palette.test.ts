import { expect, test } from 'claude-code/testing'

import { contrast, lum, palette, sections, SPECS } from './palette'

// what Claude Code's dark-ansi theme draws with each colour (see palette.ts), held to its contrast
for (const key of Object.keys(SPECS) as (keyof typeof SPECS)[]) {
  test(`${key}: every colour readable where dark-ansi uses it`, async () => {
    const p = palette(key)
    const [black, red, green, yellow, blue, magenta, cyan, white] = p.colors
    if (!black || !red || !green || !yellow || !blue || !magenta || !cyan || !white) throw new Error('eight colours')
    const text = white.intense
    expect(lum(text)).toBeGreaterThan(0.8)
    expect(lum(p.foreground.color)).toBeGreaterThan(0.8)
    expect(lum(white.color)).toBeGreaterThan(0.5)
    for (const e of [red, green, yellow, blue, magenta, cyan]) expect(lum(e.intense)).toBeGreaterThanOrEqual(0.4)
    // dim (SGR 2) text
    for (const e of [p.foreground, white, red, green, yellow, blue, magenta, cyan]) expect(lum(e.faint)).toBeGreaterThanOrEqual(0.3)
    // the strips with text on them: your messages, bash output, diff lines, the selection
    expect(contrast(text, black.intense)).toBeGreaterThan(9)
    expect(contrast(text, black.color)).toBeGreaterThan(12)
    expect(contrast(text, green.color)).toBeGreaterThan(4.5)
    expect(contrast(text, red.color)).toBeGreaterThan(4.5)
    expect(contrast(text, blue.color)).toBeGreaterThan(4.5)
  })
}

test('the sections are what Konsole reads', async () => {
  const s = sections('honu')
  for (const name of ['Background', 'Foreground', 'Color0', 'Color7Intense', 'Color3Faint']) expect(s).toContain(`[${name}]\nColor=`)
  expect(s.match(/^\[/gm)?.length).toBe(30)
  expect(s).toMatch(/^Color=\d{1,3},\d{1,3},\d{1,3}$/m)
})
