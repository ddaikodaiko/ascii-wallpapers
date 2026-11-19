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
   Chromium (on the GPU) draws every frame with the SVG clock paused and seeked, and ImageMagick packs them.
   - **At the screen's size** (from KDE's screen report, else X, else the terminal), and drawn **1:1, centred**
     (`FillStyle=NoScaling`) whenever it covers the terminal: Konsole's own wallpaper scaling is nearest-neighbour, so a
     scaled scene pixelates. Unscaled, it is sharp in a Konsole window of any size, and costs less CPU.
   - Encoded lossy at q92 with sharp RGB→YUV: plain lossy smears the small coloured glyphs and the cell grid.
   - **On the scenes' shimmer clock**: every scene's glyphs flicker through a 0.43 s cycle of three steps. Frames are
     taken mid-step, one per step (7 fps), and a loop is 24 whole cycles (10.3 s), so the flicker is even and closes
     on itself. A 1.5 s crossfade hides the seam of the slower motions.
   - Packed by `img2webp` as full opaque keyframes: ImageMagick's packing leaves alpha deltas, which Konsole decodes
     and blends on every frame.
   - A dark veil keeps the text readable. Under a minute per scene with a GPU (minutes in software), about 5 MB each.
   The picker says so and turns the wallpaper on by itself when it is ready.
2. `linux/konsole.sh` copies the tab's own colour scheme (from its profile, so your colours stay) into
   `~/.local/share/konsole/ASCII Wallpaper - <name> (<build>).colorscheme` with the scene as its wallpaper, opaque
   and with no blur behind (a translucent window over a moving wallpaper is re-blurred by the compositor every frame),
   and switches
   the tab to it with the OSC 50 sequence `konsoleprofile` uses. Konsole's D-Bus `setProfile` is off by default as
   security-sensitive; this needs no setting changed.
3. `/wallpaper off`, or the end of the Claude Code session, puts the tab back on its own scheme. Your pick is kept,
   so the next session starts with it.

In the terminal, `/wallpaper` opens a picker above the prompt: press 1–8 in the empty prompt (0 for off), and Clawd
sits beside it in half blocks, stepping with each pick.

What it costs, measured on Konsole 25.12 (1920×1080 screen, 1883×1004 terminal, idle machine): Konsole's own CPU
goes from 1% to about 10% of one core at 7 fps; the compositor stays at 1%. 14 fps (`--steps 2`) costs about 1.6x.

Needs: Konsole ≥ 23.08, [Bun](https://bun.sh), Chromium or Chrome (`AW_CHROME=/path` to choose one), ImageMagick and
libwebp's `img2webp` (optional, recommended). On Fedora: `sudo dnf install chromium ImageMagick libwebp-tools`.

To render all eight ahead of time (from a clone of this repo):

```bash
bun linux/render.ts ~/.local/share/ascii-wallpapers            # all eight
bun linux/render.ts ~/.local/share/ascii-wallpapers honu --width $(bash linux/konsole.sh screen | cut -dx -f1) --height $(bash linux/konsole.sh screen | cut -dx -f2)
bun linux/render.ts ~/.local/share/ascii-wallpapers moonlit --steps 2   # 14 fps: smoother, ~1.6x Konsole's CPU
AW_GPU=0 bun linux/render.ts ~/.local/share/ascii-wallpapers            # software only
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
