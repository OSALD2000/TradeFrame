# Capture prototype

## Implemented flow, 0.7.9

1. Enable **Auto** in Create setup or on the floating capture bar. Auto is off
   at startup; enabling it ignores a readable image already on the clipboard.
2. In TradingView, use **Copy chart image** (Linux/Windows: Ctrl+Shift+S;
   macOS: Cmd+Shift+S), or the chart camera menu. Shortcut bindings depend on the
   client; the menu is the fallback. Other apps can supply PNG images too.
3. While Auto is on, the native process checks the clipboard for PNG images every
   500 ms and adds changed image contents to the draft. It reads PNG data only,
   never requests clipboard text/HTML payloads, and never modifies the clipboard. Imported
   PNG bytes are preserved without automatic chart detection, cropping or resizing.
   Imports do not show/focus the journal or hide the trading app.
4. Each image still needs a timeframe before saving; notes are optional. Images
   stay in memory until an explicit save to the selected destinations. Clipboard
   image arrival does not write a note or send anything to an account.
5. Choose **Edit image** beside an image to use the existing full-screen still-image
   crop surface. Drag/release, or use arrows and two Enter presses; Shift moves
   faster. Escape/Cancel preserves the image. Commit replaces only that draft
   image, retaining its ID, timeframe, notes and import timestamp. Editing a saved
   image requires **Save a separate copy**; the previous Markdown/PNG stays intact.
6. **Stop Auto** immediately cancels monitoring and ignores late asynchronous
   replies. Closing the capture bar, replacing/opening a setup, closing the
   journal or quitting also stops Auto. Save/crop operations temporarily pause
   polling. Restart always starts with Auto off.

The clipboard does not reliably identify which app supplied an image. Auto can
therefore import PNGs copied from any application while it is enabled; the UI
states this explicitly. It does not detect TradingView, synthesize keystrokes,
control other apps or monitor the clipboard when Auto is off.

Unchanged consecutive PNG content is ignored, including an identical recopy.
Clearing/non-image clipboard content resets that comparison. The clipboard holds
only its latest image: rapidly replaced images, including while save/edit is busy,
can be missed. Copy one chart at a time and check the image count before the next.
Limits are 20 images, 32 MB and 16 million pixels per imported PNG, plus existing
128 MB per-setup and 256 MB cache bounds. Invalid nonempty/oversized data or
exhausted capacity stop Auto with a recoverable message, preserving the draft.
Temporarily empty PNG data, a missing advertised PNG format or native read errors
keep Auto selected and retry every poll. The safe “Auto waiting” message identifies
the read stage without exposing native error contents; it clears on recovery.
The last known image hash survives Stop/Enable in memory, so a failed baseline
and recovery do not duplicate that image. It is cleared when the journal closes.
If the activation baseline is unreadable, Auto cannot identify its old contents:
the first readable image is imported unless it matches the last known hash.
Copy again and check the draft; an unreadable initial offer cannot prove its age.

The source application's export determines the content: TradeFrame does not erase
crosshairs, indicators or other rendered pixels. Verify TradingView's own export
on the actual client. [TradingView snapshot instructions](https://www.tradingview.com/support/solutions/43000482537-how-to-share-a-snapshot/).

## Legacy native capture implementation

The native screenshot API and its tests remain for compatibility. The current
Auto UI uses clipboard images instead; Select area is no longer a capture-bar
choice. The algorithm/platform notes below and 0.7.7 evidence describe that older
native screen-capture path, not the new Auto behavior.

## Local chart isolation

Automatic detection samples common colors in the central 80% of the image, then
projects their matching pixels onto rows and columns. It takes the outer extent
of those projections, rather than selecting a run separated by a trendline. It compares all four native
channels symmetrically, without assuming RGBA/BGRA order. A 6-level per-channel
tolerance handles small variations; rows/columns need at least 20% matching
pixels, with a minimum of eight. This allows a narrower chart alongside a large
panel. A candidate must cover
at least 25% of the image and have at least 60% matching background inside its
bounds. Regions touching three or four source edges and similarly ranked
competing regions are rejected; there is no claim of semantic chart recognition.

This supports distinct white, dark and colored chart backgrounds, independently
of text OCR. Identical panel/chart backgrounds, wide colored drawing zones,
gradients and very small charts can defeat the heuristic. Multiple panes with
the same background are kept together rather than cutting off one pane.
No result, a full-image result or detection failure retains the original image
and shows a full-image note in the source picker/setup. Use Select area when
precise bounds are needed. Automatic bounds can still be inaccurate; check the
normal setup image before saving. No additional approval preview is imposed.

Select area always uses the original new capture and never runs automatic
cropping on the selected rectangle. A tiny detail or the whole source is valid;
the main process rejects noninteger/out-of-bounds/empty rectangles and stale
source tokens. Dragging outside the displayed image clamps to its edges. Pointer starts in letterbox padding are ignored. A
click, pointer cancellation or lost pointer capture does not add an image.
Selection runs on a still image inside the full-screen app, not on a live desktop
overlay. The source and marks share one SVG coordinate system with proportional
scaling. Pointer mapping accounts for letterboxing, and marks clear before export.
The capture bar stays transparent and ignores mouse input during area selection,
then recovers on commit or cancellation so it cannot cover the selection surface.

The native process re-decodes a 1x PNG before cropping so image, bitmap and
rectangle bounds share pixel coordinates across DPI scales. The renderer sees
only the existing opaque image URL, never filesystem or raw bitmap access.
Only the cropped PNG enters the existing save/append/delivery path. No new
file format, external process, network service or OCR dependency is involved;
existing saved/imported images and OneNote credentials are untouched.

Native APIs: [nativeImage](https://www.electronjs.org/docs/latest/api/native-image).

## Capture and platform limits

The prototype uses `desktopCapturer.getSources()` thumbnails as snapshots,
requesting the largest physical display dimensions reported by Electron
(display size times scale factor), rather than capping the request at 2560x1440.
It serializes the highest available native image representation before decoding
at pixel scale 1 for cropping. PNG cropping is lossless and introduces no resize
or JPEG compression. The OS/portal still controls the returned source size;
a large request cannot restore details absent from that source. The automatic
detector skips images above 16 million pixels; area selection preserves them
subject to the existing PNG/cache size limits. Empty images and TradeFrame's own window sources are
excluded. A compositor delay reduces the chance of recording the capture bar,
but native tests must verify the actual screenshot contents. A full-screen
snapshot can still include other visible applications; choose the intended chart
window when offered. The journal is hidden during the request and the bar stays
transparent. A selection marker reported in 0.7.3 PNGs was absent on the owner's
next attempt; no affected original PNG was available. Its cause is unresolved;
this repair does not claim that a portal-origin artifact has been eliminated.

The bar requests always-on-top behavior. On Wayland, window placement and
stacking are controlled by the compositor; Electron cannot guarantee them.
Capture uses Electron 45's opacity and input-region APIs instead of hide/show
to preserve placement without reading or setting global Wayland coordinates.
Verify on the actual compositor that transparency excludes the bar from images
and that opacity and mouse input recover after success, cancellation, and error.
Position is not persisted across app restarts; explicit close/reopen can still
let the compositor place the bar again.
On macOS screen-recording access needs user consent. Permission denial or portal
cancellation restores the journal and offers a retry; no security protection is
disabled. PipeWire may return only the source chosen in its system picker.

Sources: [desktopCapturer](https://www.electronjs.org/docs/latest/api/desktop-capturer)
and [BrowserWindow platform notes](https://www.electronjs.org/docs/latest/api/browser-window).

### Sway floating rule

If the capture bar tiles instead of floating, the owner can add this rule to
their Sway configuration, then reload it normally:

```text
for_window [title="^TradeFrame Capture$"] floating enable, sticky enable
```

The app keeps this title stable for matching. The rule requests a floating bar
visible across workspaces; it is not a cross-platform always-on-top guarantee.
The app and agent do not edit desktop configuration automatically.

## Native synthetic-input verification, 5 November 2026

The packaged 0.7.7 app was exercised on a private headless Sway display with a
synthetic 1200x600 PNG returned only at `desktopCapturer.getSources`. Real Electron
image decoding, renderer/preload/IPC, pointer mapping, native cropping and PNG
file writes were used. Full-screen letterboxed area selection produces exactly
the expected 501x251 bitmap; Auto chart produces exactly the expected 1040x520
bitmap. Every exported pixel equals the independently prepared expected image.
Two distinct timeframes and multiline notes survive save, append, local reopen
and folder delivery; the append backup equals the complete previous Markdown.
The selector restores the previous full-screen state, and the 680x128 bar fits.

Without that input fixture, capture in the private session reports unavailable
screen access, clears busy state and restores the journal/bar. This does not
verify the real portal, actual source resolution, capture-bar exclusion, the
reported marker, physical DPI or real chart accuracy. Those checks below remain
required. Sandbox setup and input boundaries are recorded in
[RELEASE](RELEASE.md#native-linux-verification-5-november-2026).

## Native portal verification, 5 November 2026

A subsequent isolated session runs actual desktop capture through private D-Bus,
PipeWire, WirePlumber's policy-only profile and the wlr portal, with one explicitly
selected synthetic HEADLESS-1 output. A 1600x1000 deterministic PNG is displayed
by swaybg. The real `desktopCapturer.getSources` result is observed without
replacing its images, sources or promise result. The full portal source equals
every expected pixel, excluding the journal/bar; native UI save/append exports
the expected 1440x920 Auto chart, 501x251 pointer crop and 11x11 keyboard crop with
zero differing channels. The keyboard check uses both single-pixel and Shift
movement plus two Enter presses; no selection cursor enters the saved PNG.

Area selection started from Connections returns to Create. Escape keeps existing
screenshots and restores the previous full-screen state. A private portal chooser
that declines the source produces a recoverable error, preserves all three saved
images/timeframes and exact Markdown bytes, and restores the journal/bar. After
restoring that backend, the existing capture bar successfully captures again.

All services, sockets, permissions-store data and configurations are temporary;
system-bus access points at a nonexistent private socket, and no hardware monitors
are loaded. The user's desktop, profile, journals, accounts and global settings
are untouched. Test processes are closed afterward. Portal configuration follows
the installed manual and [upstream wlr documentation](https://github.com/emersion/xdg-desktop-portal-wlr).

This verifies a real Linux headless portal at scale 1, using the temporary package
copy's sandbox-helper setup documented in [RELEASE](RELEASE.md#native-linux-verification-5-november-2026).
It does not establish physical/scaled display quality, stacking/drag placement,
interactive permission/source-picker behavior, actual trading-chart detection,
Windows/macOS or elimination of the owner's previously reported marker.

## Manual acceptance checks

The isolated native 0.7.8 run passes initial-image suppression, two external
`wl-copy` imports with byte-exact saves, no native window activation, duplicate
suppression, stop and invalid-PNG recovery. Mouse/keyboard crops export the exact
expected 101x81/11x11 pixels without adding another screenshot; cancellation and
Save copy preserve the original files/metadata. Desktop/minimum-width, edit and
normal/error capture-bar screenshots are inspected. This uses a synthetic profile,
private Wayland socket and test-only runtime copy with an existing sandbox helper;
no real clipboard/account/journal is accessed. All test processes are closed.

Use synthetic images and temporary folders; do not copy personal/account content.

- Start with Auto off and an existing clipboard image. Enable Auto; verify that
  the old image is not imported. Copy a new PNG from TradingView/Desktop/browser
  and inspect its dimensions/pixels. Repeat with several images and timeframes.
- Verify Linux/Windows/macOS shortcut hints and the actual client's camera-menu
  fallback. A platform hint is not tested support on that OS.
- Check that background imports do not activate the journal or take focus from
  the trading app. Unchanged clipboard content must not add duplicates.
- Disable Auto, close the bar, replace/open the draft and restart the app;
  confirm monitoring stops and old/late results cannot enter the next draft.
- After one import, supply temporarily empty PNG data or an advertised PNG missing
  from the format list. Auto must remain selected; restart it during the failure,
  restore the previous image without duplication, then copy a different image.
  The waiting message must clear and the next image must arrive.
- Copy an unsupported/non-image item, then a PNG. Text contents must not enter
  the draft. Invalid/oversized images stop Auto without changing existing images.
- Edit one image with mouse and keyboard; inspect exact exported pixels and
  metadata. Cancel and verify the image survives unchanged. Edit a full 20-image
  draft without adding an image. Use Save copy after editing a saved image and
  verify the old files remain byte-identical.
- Save/reopen/append and verify image notes/timeframes and selected folder/cloud
  results separately. Inspect desktop and narrow layouts and the 680x128 bar.

Real Windows/macOS clipboard ownership/formats, TradingView export content,
physical display scaling and assistive technology require target-system checks.
