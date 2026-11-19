# ASCII Wallpapers for Claude Code — Linux fork

> Fork of [Handsher/ascii-wallpapers](https://github.com/Handsher/ascii-wallpapers) that also works in a **Linux terminal**:
> in Konsole the live scene goes behind Claude Code itself, as the tab's animated wallpaper. See [Linux](#linux) below.
> Claude Desktop and the mobile app behave exactly as upstream.

Eight live ASCII wallpapers behind the chat in Claude Desktop. Each scene is painted in character cells that shimmer and move, and the window's panels turn to frosted glass over it, so the chat stays easy to read.

![The eight wallpapers](assets/preview.jpg)

**Claude Code** · **Cloud Drift** · **Honu Lagoon** · **Koi Pond** · **Jellyfish** · **Paper Boats** · **Fireflies** · **Moonlit**

From the concept film on X: https://x.com/handsher_NGU/status/2121399044560015748

## Install

At the prompt of a terminal session of Claude Code:

```
/plugin install ascii-wallpapers --marketplace ddaikodaiko/ascii-wallpapers
```

Answer `y` to add the marketplace, then pick a scope (user scope puts it in every session).

From a shell:

```bash
claude plugin install ascii-wallpapers --marketplace ddaikodaiko/ascii-wallpapers
```

In the desktop app, where `/plugin` does not run: click **+** next to the prompt box, then **Plugins**, **Add marketplace** with `ddaikodaiko/ascii-wallpapers`, then **Add plugin**.

Then start a new session in the Code tab of Claude Desktop.

## Use

- `/wallpaper` opens the picker above the prompt. Click a wallpaper (or focus the picker and press 1–8, 0 for off). Clawd the crab sits on it and hops when you pick one.
- `/wallpaper honu` (or any name), `/wallpaper off`.
- `/wallpaper crab off` sends Clawd to rest; `/wallpaper crab on` brings him back.
- Your pick is kept for the next session.

## Linux

Claude Code's terminal UI draws no plugin backdrops, so on Linux this fork puts the scene behind the terminal instead.

**Konsole 23.08 or later** plays an animated WebP as a colour scheme's wallpaper. When you pick a wallpaper in a
terminal session:

1. The scene is rendered once to `~/.local/share/ascii-wallpapers/<scene>.webp` (`linux/render.ts`): headless
   Chromium draws every frame with the SVG clock paused and seeked, ImageMagick packs them into a 10 s loop at 8 fps,
   1600×900, with a 1.5 s crossfade over the seam and a dark veil so the text stays readable. About 3 minutes per scene
   on 12 cores, and 1–2 MB each. The picker says so and turns the wallpaper on by itself when it is ready.
2. `linux/konsole.sh` copies the tab's own colour scheme (from its profile, so your colours, opacity and blur stay)
   into `~/.local/share/konsole/ASCII Wallpaper - <name>.colorscheme` with the scene as its wallpaper, and switches
   the tab to it with the OSC 50 sequence `konsoleprofile` uses. Konsole's D-Bus `setProfile` is off by default as
   security-sensitive; this needs no setting changed.
3. `/wallpaper off`, or the end of the Claude Code session, puts the tab back on its own scheme. Your pick is kept,
   so the next session starts with it.

In the terminal, `/wallpaper` opens a picker above the prompt: press 1–8 in the empty prompt (0 for off), and Clawd
sits beside it in half blocks, stepping with each pick.

Needs: Konsole ≥ 23.08, [Bun](https://bun.sh), Chromium or Chrome (`AW_CHROME=/path` to choose one) and ImageMagick.
On Fedora: `sudo dnf install chromium ImageMagick`.

To render all eight ahead of time (from a clone of this repo):

```bash
bun linux/render.ts ~/.local/share/ascii-wallpapers            # all eight
bun linux/render.ts ~/.local/share/ascii-wallpapers honu moonlit --fps 12 --seconds 12 --width 1920 --height 1080
```

Other terminals (kitty, GNOME Terminal, Ptyxis, Alacritty…) can't play an animated wallpaper; the picker says so and
leaves them as they are.

## Notes

- Wallpapers draw in Claude Desktop (and the mobile app), and behind Konsole on Linux; other terminals keep their own look.
- One theme at a time: turn off any other plugin that sets a theme.
- Needs a Claude Code version whose desktop app draws plugin backdrops (2.1.325 or later).
- The scenes are SVG with SMIL motion, generated from the concept film's own scene code.

## Remove

```bash
claude plugin uninstall ascii-wallpapers
```

MIT License.
