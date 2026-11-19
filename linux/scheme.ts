// Prints a scene's Konsole colours (linux/palette.ts) as a colour scheme's sections: linux/konsole.sh writes them in.
//
//   bun linux/scheme.ts <scene>
import { type Key, sections, SPECS } from './palette'

const key = process.argv[2]
if (!key || !(key in SPECS)) {
  console.error(`usage: bun linux/scheme.ts <scene>: one of ${Object.keys(SPECS).join(', ')}`)
  process.exit(2)
}
process.stdout.write(sections(key as Key))
