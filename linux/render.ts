// Renders the plugin's SVG scenes to looping animated WebP files, so a Linux terminal (Konsole) can show them as its
// wallpaper behind Claude Code. Headless Chromium draws each frame with the SMIL clock paused and seeked, so every frame is
// exact; ImageMagick packs them. No npm dependencies: Chromium is driven over the DevTools protocol directly.
//
//   bun linux/render.ts <outDir> [scene ...] [--width 1920] [--height 1080] [--steps 2] [--cycles 24] [--fade 1.5] [--workers N]
//
// Render at the terminal's own pixel size (konsole.sh size): Konsole then draws each frame as it is, with no scaling.
// Every scene's glyphs shimmer on one clock, a 0.43 s cycle of three steps; frames are sampled mid-step, `steps` per
// step (2: about 14 fps), and a loop is a whole number of cycles, so the shimmer stays even and closes on itself. The
// scenes' other motions have unrelated periods, so the last `fade` seconds of each loop are blended into its first ones.
import { mkdir, mkdtemp, rename, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { SCENES } from '../hooks/scenes.js'

type Key = keyof typeof SCENES
const DARK_VEIL = 0.42 // the film's dark glass is 55% over panels; the terminal's text sits on the scene itself, so a lighter veil
const LIGHT_VEIL = 0.55 // Cloud Drift is a light scene: a stronger veil keeps a dark terminal theme readable over it

const args = process.argv.slice(2)
const opt = (name: string, dflt: number) => {
  const i = args.indexOf(`--${name}`)
  if (i < 0) return dflt
  const v = Number(args[i + 1])
  args.splice(i, 2)
  if (!Number.isFinite(v) || v <= 0) throw new Error(`--${name} needs a positive number`)
  return v
}
const W = Math.round(opt('width', 1920)), H = Math.round(opt('height', 1080)), STEPS = Math.round(opt('steps', 2)), CYCLES = Math.round(opt('cycles', 24)), FADE = opt('fade', 1.5)
const SHIMMER = 0.43 // the scenes' shared glyph shimmer: one cycle, three discrete steps
const DT = SHIMMER / 3 / STEPS // seconds per frame
const SECONDS = CYCLES * SHIMMER
const WORKERS = Math.min(16, Math.round(opt('workers', Math.max(1, navigator.hardwareConcurrency - 2))))
const [outArg, ...wanted] = args
if (!outArg) {
  console.error('usage: bun linux/render.ts <outDir> [scene ...] [--width W] [--height H] [--steps N] [--cycles N] [--fade S] [--workers N]')
  process.exit(2)
}
const OUT = resolve(outArg)
const keys = (wanted.length ? wanted : Object.keys(SCENES)) as Key[]
for (const k of keys) if (!(k in SCENES)) throw new Error(`unknown scene "${k}": one of ${Object.keys(SCENES).join(', ')}`)

function which(names: string[]): string | null {
  for (const n of names) {
    const p = Bun.which(n)
    if (p) return p
  }
  return null
}
const CHROME = process.env.AW_CHROME ?? which(['chromium-browser', 'chromium', 'google-chrome-stable', 'google-chrome', 'brave-browser'])
const MAGICK = which(['magick', 'convert'])
if (!CHROME) throw new Error('needs Chromium or Chrome on PATH (or AW_CHROME=/path/to/chrome)')
if (!MAGICK) throw new Error('needs ImageMagick (magick) on PATH')

// ---------- a minimal DevTools protocol client ----------
class Cdp {
  private id = 0
  private waiting = new Map<number, { ok: (v: any) => void; fail: (e: Error) => void }>()
  private constructor(private ws: WebSocket) {
    ws.addEventListener('message', ev => {
      const msg = JSON.parse(String(ev.data))
      const w = msg.id != null ? this.waiting.get(msg.id) : undefined
      if (!w) return
      this.waiting.delete(msg.id)
      msg.error ? w.fail(new Error(`${msg.error.message} (${msg.error.code})`)) : w.ok(msg.result)
    })
  }
  static open(url: string) {
    return new Promise<Cdp>((ok, fail) => {
      const ws = new WebSocket(url)
      ws.addEventListener('open', () => ok(new Cdp(ws)), { once: true })
      ws.addEventListener('error', () => fail(new Error(`cannot reach ${url}`)), { once: true })
    })
  }
  send<T = any>(method: string, params: object = {}) {
    const id = ++this.id
    this.ws.send(JSON.stringify({ id, method, params }))
    return new Promise<T>((ok, fail) => this.waiting.set(id, { ok, fail }))
  }
  close() { this.ws.close() }
}

// the GPU rasterizes the glyph masks and filters about ten times faster than Chromium's software path; without a usable
// GPU Chromium falls back to software by itself. AW_GPU=0 forces software.
const GPU = process.env.AW_GPU === '0' ? ['--disable-gpu'] : ['--enable-gpu', '--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu-rasterization']

async function launch(profile: string) {
  const proc = Bun.spawn([CHROME!, '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run',
    '--no-default-browser-check', `--window-size=${W},${H}`, '--hide-scrollbars', '--mute-audio', ...GPU, ...(process.env.AW_CHROME_FLAGS?.split(' ').filter(Boolean) ?? []), 'about:blank'], { stdout: 'ignore', stderr: 'pipe' })
  const reader = proc.stderr.getReader()
  let buf = ''
  const deadline = Date.now() + 20_000
  while (Date.now() < deadline) {
    const { value, done } = await reader.read()
    if (done) break
    buf += new TextDecoder().decode(value)
    const m = buf.match(/DevTools listening on (ws:\/\/[^\s]+)/)
    if (m) {
      reader.releaseLock()
      const port = new URL(m[1]).port
      const list: { type: string; webSocketDebuggerUrl: string }[] = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
      const page = list.find(t => t.type === 'page')
      if (!page) throw new Error('Chromium opened no page')
      return { proc, cdp: await Cdp.open(page.webSocketDebuggerUrl) }
    }
  }
  proc.kill()
  throw new Error(`Chromium did not start:\n${buf.slice(-2000)}`)
}

const TONE: Record<Key, 'dark' | 'light'> = { clawd: 'dark', clouds: 'light', honu: 'dark', koiPond: 'dark', jellyfish: 'dark', paperBoats: 'dark', fireflies: 'dark', moonlit: 'dark' }

async function run(cmd: string[]) {
  const p = Bun.spawn(cmd, { stdout: 'ignore', stderr: 'pipe' })
  const err = await new Response(p.stderr).text()
  if ((await p.exited) !== 0) throw new Error(`${cmd[0]} failed: ${err.slice(-1500)}`)
}

const work = await mkdtemp(join(tmpdir(), 'aw-render-'))
await mkdir(OUT, { recursive: true })
// each frame costs seconds of software raster (glyph-pattern masks, morphology filters), so frames are shared out over
// several headless browsers
const browsers = await Promise.all(Array.from({ length: WORKERS }, (_, i) => launch(join(work, `profile-${i}`))))
// killed (the plugin's timeout, ctrl+c): take the browsers and the frames down too
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
  process.on(sig, async () => {
    for (const b of browsers) b.proc.kill()
    // a closing browser still writes its profile: remove the folder once they are gone
    await Promise.race([Promise.all(browsers.map(b => b.proc.exited)), Bun.sleep(3000)])
    await rm(work, { recursive: true, force: true }).catch(() => undefined)
    process.exit(130)
  })
}
const pad = (i: number) => String(i).padStart(4, '0')

async function load(cdp: Cdp, file: string) {
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false })
  await cdp.send('Page.navigate', { url: `file://${file}` })
  for (let i = 0; i < 200; i++) {
    const r = await cdp.send('Runtime.evaluate', { expression: `document.readyState === 'complete' && !!document.querySelector('#s>svg')`, returnByValue: true })
    if (r.result.value) break
    await Bun.sleep(50)
  }
  await cdp.send('Runtime.evaluate', { expression: `document.fonts.ready.then(() => { document.querySelector('#s>svg').pauseAnimations() })`, awaitPromise: true })
}

async function shoot(cdp: Cdp, t: number, path: string) {
  await cdp.send('Runtime.evaluate', { expression: `document.querySelector('#s>svg').setCurrentTime(${t.toFixed(4)})` })
  // two animation frames so the seeked state is painted before the capture
  await cdp.send('Runtime.evaluate', { expression: `new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))`, awaitPromise: true })
  const shot = await cdp.send<{ data: string }>('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  await writeFile(path, Buffer.from(shot.data, 'base64'))
}

try {
  for (const key of keys) {
    const t0 = Date.now()
    const veil = TONE[key] === 'light' ? LIGHT_VEIL : DARK_VEIL
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#0c0c0c}`
      + `#s{position:fixed;inset:0}#s>svg{display:block;width:100%;height:100%}#v{position:fixed;inset:0;background:rgba(12,12,12,${veil})}</style></head>`
      + `<body><div id="s">${SCENES[key]}</div><div id="v"></div></body></html>`
    const file = join(work, `${key}.html`)
    await writeFile(file, html)
    const dir = join(work, key)
    await mkdir(dir)

    // a start well into the scene, so every part that fades in on load is already on, on a shimmer cycle's start
    const START = 70 * SHIMMER
    const frames = CYCLES * 3 * STEPS, fadeFrames = Math.min(frames, Math.round(FADE / DT))
    const jobs: { t: number; path: string }[] = []
    for (let i = 0; i < frames; i++) jobs.push({ t: START + DT / 2 + i * DT, path: join(dir, `f${pad(i)}.png`) })
    for (let i = 0; i < fadeFrames; i++) jobs.push({ t: START + SECONDS + DT / 2 + i * DT, path: join(dir, `t${pad(i)}.png`) })
    let next = 0, done = 0
    await Promise.all(browsers.map(async ({ cdp }) => {
      await load(cdp, file)
      while (next < jobs.length) {
        const job = jobs[next++]
        await shoot(cdp, job.t, job.path)
        done++
        if (process.stdout.isTTY) process.stdout.write(`\r${key}: ${done}/${jobs.length} frames`)
      }
    }))
    // blend the frames past the loop's end into its first ones, so the loop's seam is a short crossfade
    await Promise.all(Array.from({ length: fadeFrames }, (_, i) => {
      const w = Math.round(((i + 1) / (fadeFrames + 1)) * 100)
      const f = join(dir, `f${pad(i)}.png`), t = join(dir, `t${pad(i)}.png`)
      return run([MAGICK!, t, f, '-compose', 'blend', '-define', `compose:args=${w}`, '-composite', f])
    }))
    const tmp = join(OUT, `.${key}.webp.part`)
    // DT as ImageMagick ticks: 0.43 / 3 / STEPS s = 43 / (300 * STEPS) s
    await run([MAGICK!, '-delay', `43x${300 * STEPS}`, '-loop', '0', join(dir, 'f*.png'), '-quality', '90', '-define', 'webp:method=4', `webp:${tmp}`])
    await rename(tmp, join(OUT, `${key}.webp`))
    await rm(dir, { recursive: true, force: true })
    console.log(`${process.stdout.isTTY ? '\r' : ''}${key}: ${frames} frames ${W}x${H} in ${((Date.now() - t0) / 1000).toFixed(0)}s -> ${join(OUT, `${key}.webp`)}`)
  }
} finally {
  for (const b of browsers) { b.cdp.close(); b.proc.kill() }
  await Promise.race([Promise.all(browsers.map(b => b.proc.exited)), Bun.sleep(3000)])
  await rm(work, { recursive: true, force: true })
}
