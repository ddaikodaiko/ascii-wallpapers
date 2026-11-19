#!/usr/bin/env bash
# ASCII Wallpapers on Linux: shows a rendered scene (linux/render.ts) as the wallpaper of the Konsole tab Claude Code runs
# in, behind the chat. Konsole 23.08+ plays an animated WebP as a colour scheme's wallpaper; the tab is switched to a
# scheme made from its own one plus the wallpaper, with the OSC 50 sequence konsoleprofile uses (Konsole's D-Bus
# setProfile is off by default as security-sensitive, and this needs no setting changed).
#
#   konsole.sh check            exit 0 when this is a Konsole tab whose terminal can be reached
#   konsole.sh dir              print the folder the rendered scenes live in
#   konsole.sh size             print the terminal's size in pixels (WxH), to render at it and spare Konsole a scaling
#   konsole.sh has <key>        exit 0 when <key>.webp is rendered
#   konsole.sh on <key> <label> show <key> behind the tab
#   konsole.sh off              back to the tab's own colour scheme
set -euo pipefail

DATA="${XDG_DATA_HOME:-$HOME/.local/share}"
WALLS="${AW_DIR:-$DATA/ascii-wallpapers}"
KDIR="$DATA/konsole"
PREFIX="ASCII Wallpaper - "

die() { echo "$*" >&2; exit 1; }

# the terminal Claude Code draws on: the first process up from here whose stdout is one
find_tty() {
  local p="${CLAUDE_PID:-$PPID}" t
  while [ -n "$p" ] && [ "$p" -gt 1 ]; do
    t=$(readlink "/proc/$p/fd/1" 2>/dev/null || true)
    case "$t" in /dev/pts/*) [ -w "$t" ] && { echo "$t"; return 0; } ;; esac
    p=$(ps -o ppid= -p "$p" 2>/dev/null | tr -d ' ')
  done
  return 1
}

qdbus_bin() {
  local q
  for q in qdbus6 qdbus-qt6 qdbus; do command -v "$q" >/dev/null && { echo "$q"; return 0; }; done
  return 1
}

# the colour scheme the tab's profile names (Breeze when it names none); read from the profile file, so a wallpaper
# already on never counts as the base
base_scheme() {
  local prof="" q f s
  if q=$(qdbus_bin) && [ -n "${KONSOLE_DBUS_SERVICE:-}" ] && [ -n "${KONSOLE_DBUS_SESSION:-}" ]; then
    prof=$("$q" "$KONSOLE_DBUS_SERVICE" "$KONSOLE_DBUS_SESSION" profile 2>/dev/null || true)
  fi
  [ -n "$prof" ] || prof=$(sed -n 's/^DefaultProfile=\(.*\)\.profile$/\1/p' "${XDG_CONFIG_HOME:-$HOME/.config}/konsolerc" 2>/dev/null | head -1)
  for f in "$KDIR"/*.profile; do
    [ -f "$f" ] || continue
    if grep -qxF "Name=$prof" "$f"; then
      s=$(sed -n 's/^ColorScheme=//p' "$f" | head -1)
      [ -n "$s" ] && case "$s" in "$PREFIX"*) ;; *) echo "$s"; return 0 ;; esac
    fi
  done
  echo Breeze
}

scheme_file() {
  local d dirs=("$KDIR") IFS=:
  for d in ${XDG_DATA_DIRS:-/usr/local/share:/usr/share}; do dirs+=("$d/konsole"); done
  for d in "${dirs[@]}"; do
    [ -f "$d/$1.colorscheme" ] && { echo "$d/$1.colorscheme"; return 0; }
  done
  return 1
}

osc50() {
  local tty
  tty=$(find_tty) || die "no terminal to reach"
  # one write, so it lands whole between Claude Code's own frames
  printf '\033]50;ColorScheme=%s\007' "$1" > "$tty"
}

case "${1:-}" in
  check)
    [ -n "${KONSOLE_VERSION:-}" ] || die "not a Konsole tab (KONSOLE_VERSION unset)"
    [ "${KONSOLE_VERSION}" -ge 230800 ] || die "Konsole ${KONSOLE_VERSION} is older than 23.08, which plays animated wallpapers"
    find_tty >/dev/null || die "no terminal to reach"
    echo "konsole ${KONSOLE_VERSION}"
    ;;
  dir)
    echo "$WALLS"
    ;;
  size)
    tty=$(find_tty) || die "no terminal to reach"
    python3 -I - "$tty" <<'PY' || die "the terminal reports no pixel size"
import fcntl, os, struct, sys, termios
fd = os.open(sys.argv[1], os.O_RDONLY | os.O_NOCTTY)
_, _, w, h = struct.unpack('HHHH', fcntl.ioctl(fd, termios.TIOCGWINSZ, bytes(8)))
if not w or not h:
    sys.exit(1)
print(f'{w}x{h}')
PY
    ;;
  has)
    [ -f "$WALLS/${2:?key}.webp" ]
    ;;
  on)
    key="${2:?key}" label="${3:?label}"
    img="$WALLS/$key.webp"
    [ -f "$img" ] || die "$img is not rendered yet"
    base=$(base_scheme)
    name="$PREFIX$label"
    out="$KDIR/$name.colorscheme"
    mkdir -p "$KDIR"
    src=$(scheme_file "$base" || true)
    {
      # the base scheme's [General] minus what the wallpaper sets, then ours, then its colours as they are
      printf '[General]\nDescription=%s\n' "$name"
      if [ -n "$src" ]; then
        awk '/^\[General\]/{g=1;next} /^\[/{g=0} g && !/^(Description|Wallpaper|WallpaperOpacity|WallpaperFlipType|FillStyle|Anchor)=/ && NF' "$src"
      fi
      printf 'Wallpaper=%s\nFillStyle=Crop\nAnchor=0.5,0.5\nWallpaperOpacity=1\nWallpaperFlipType=NoFlip\n\n' "$img"
      if [ -n "$src" ]; then
        awk '/^\[General\]/{g=1;next} /^\[/{g=0} !g' "$src"
      fi
    } > "$out.part"
    mv "$out.part" "$out"
    osc50 "$name"
    echo "on: $name"
    ;;
  off)
    base=$(base_scheme)
    osc50 "$base"
    echo "off: $base"
    ;;
  *)
    die "usage: konsole.sh check | dir | size | has <key> | on <key> <label> | off"
    ;;
esac
