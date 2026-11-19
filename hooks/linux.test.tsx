import { expect, test } from 'claude-code/testing'
import type { On } from 'claude-code'

// The terminal draws no look: a pick goes to linux/konsole.sh, which puts the rendered scene behind the Konsole tab.
function engine(on: On, rendered: boolean) {
  const runs: string[][] = []
  on('command.register', () => ({ value: { command: 'wallpaper' } }))
  on('theme.set', () => ({ value: { isDrawn: false, reason: 'the terminal draws no look' } }) as never)
  on('theme.clear', () => ({ value: undefined }) as never)
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.end', () => ({ sessionId: 's' }) as never)
  on('store.get', () => ({ value: undefined }))
  on('store.set', () => ({ value: undefined }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }) as never)
  on('process.hookEnv', () => ({ value: { CLAUDE_PLUGIN_ROOT: '/plugin', CLAUDE_PID: '42' } }) as never)
  on('process.run', (_, e) => {
    runs.push([...e.argv])
    const sub = e.argv[2]
    const out = sub === 'check' ? 'konsole 251203' : sub === 'dir' ? '/walls' : ''
    const exitCode = sub === 'has' && !rendered ? 1 : 0
    return { value: { exitCode, stdout: out, stderr: '' } } as never
  })
  return runs
}

test('in a Konsole tab, /wallpaper honu puts the lagoon behind the terminal and off takes it away', async ($, on) => {
  const runs = engine(on, true)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  expect(JSON.stringify(await $.command.run({ command: 'wallpaper', args: 'honu' } as never))).toContain('Honu Lagoon is on.')
  expect(runs.some(r => r.join(' ') === 'bash /plugin/linux/konsole.sh on honu Honu Lagoon')).toBe(true)

  expect(JSON.stringify(await $.command.run({ command: 'wallpaper', args: 'off' } as never))).toContain('Wallpaper off.')
  expect(runs.at(-1)?.join(' ')).toBe('bash /plugin/linux/konsole.sh off')
})

test('a scene not yet rendered is rendered first', async ($, on) => {
  const runs = engine(on, false)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  expect(JSON.stringify(await $.command.run({ command: 'wallpaper', args: 'moonlit' } as never))).toContain('Rendering Moonlit')
  // the render runs on after the command answers
  for (let i = 0; i < 200 && !runs.some(r => r[0] === 'bun'); i++) await Promise.resolve()
  expect(runs.some(r => r[0] === 'bun' && r[1] === '/plugin/linux/render.ts' && r[2] === '/walls' && r[3] === 'moonlit')).toBe(true)
})

test('the terminal picker lists the eight wallpapers as buttons, with Clawd beside it', async ($, on) => {
  engine(on, true)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'wallpaper', args: '' } as never)
  const ui = await $.ui.mount({ plugin: 'ascii-wallpapers', component: 'AbovePrompt', requestId: 'a', surface: 'terminal', props: {} } as never)
  for (const key of ['clawd', 'clouds', 'honu', 'koiPond', 'jellyfish', 'paperBoats', 'fireflies', 'moonlit']) {
    expect((await ui.find({ type: 'Button', key } as never)) === undefined).toBe(false)
  }
  expect((await ui.find({ type: 'Button', key: 'nope' } as never)) === undefined).toBe(true)
  expect((await ui.find({ type: 'Text', text: /█/ })) === undefined).toBe(false)
  expect((await ui.find({ type: 'Text', text: /nothing like this/ })) === undefined).toBe(true)
  await ui.unmount()
})
