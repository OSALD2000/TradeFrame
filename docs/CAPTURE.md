# Capture prototype

## Implemented flow

1. Click **Capture chart** in the desktop journal. The main window stays visible and a
   compact, draggable **TradeFrame Capture** bar opens.
2. Choose **Auto chart** or **Select area** on the bar. TradeFrame makes the capture bar transparent
   and ignores mouse input there, waits briefly for the compositor, then requests
   screen/window snapshots from Electron. The native bar remains mapped so it
   retains its dragged position rather than being placed again by Wayland.
   The journal stays visible, including while the operating system's source picker is open.
3. On PipeWire, the operating system may prompt for a screen/window. If only one
   image is returned, Auto chart detects/crops it locally and adds it directly.
   Select area instead opens a still-image selection surface in TradeFrame:
   drag a rectangle and release to add just those pixels, or Escape/Cancel to
   abandon it. There is no further preview/confirmation. Arrow keys move the
   selection cursor; Enter marks the first corner and Enter again adds the area.
   Shift moves the cursor faster. When multiple sources
   are returned, choose a snapshot in the journal. After each capture attempt,
   the bar reappears and stays open for another screenshot, including after
   cancellation or failure.
4. **Cancel selection** preserves all earlier screenshots. **Remove** deletes only
   the selected draft image. **Add screenshot** returns to the floating controls;
   failed/cancelled capture preserves the current setup. Each view has an optional
   caption and a capture timestamp; a setup contains up to 20 views.
5. **Close capture bar** in the journal, or **Journal** / **×** on the bar, hides
   the bar explicitly without discarding the preview. Closing the app closes it too.

This collects individual snapshots, not video. Captures and source titles
stay in memory until explicit save; candidate-source titles are not exported.
Saving may deliver the selected setup to explicitly connected destinations;
[SYNC](SYNC.md) describes those boundaries. All candidate
snapshots are collected at capture time and discarded after selection. Closing
the journal clears unsaved screenshots after a discard confirmation. To save images and setup
details locally, use [the journal save flow](JOURNAL.md). There is no global
shortcut, annotation tool or saved crop profile.

## Local chart isolation

Automatic detection samples common colors in the central 80% of the image, then
projects their matching pixels onto rows and columns. It compares all four native
channels symmetrically, without assuming RGBA/BGRA order. A 6-level per-channel
tolerance handles small variations, rows/columns need 50% matching pixels, and
short gaps up to 12 pixels between matches are bridged. A candidate must cover
at least 25% of the image and have at least 60% matching background inside its
bounds. Substantial separated runs or similarly ranked competing regions are
rejected; there is no claim of semantic chart recognition.

This supports distinct white, dark and colored chart backgrounds, independently
of text OCR. Identical panel/chart backgrounds, wide colored drawing zones,
multiple panes, gradients and very small charts can defeat the heuristic.
No result, a full-image result or detection failure retains the original image
and shows a full-image note in the source picker/setup. Use Select area when
precise bounds are needed. Automatic bounds can still be inaccurate; check the
normal setup image before saving. No additional approval preview is imposed.

Select area always uses the original new capture and never runs automatic
cropping on the selected rectangle. A tiny detail or the whole source is valid;
the main process rejects noninteger/out-of-bounds/empty rectangles and stale
source tokens. Dragging outside the displayed image clamps to its edges. A
click, pointer cancellation or lost pointer capture does not add an image.
Selection runs on a still image inside the app, not on a live desktop overlay.
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
requesting 2560x1440. Returned sizes depend on the platform; native-resolution
capture is not guaranteed. Empty images and TradeFrame's own window sources are
excluded. A compositor delay reduces the chance of recording the capture bar,
but native tests must verify the actual screenshot contents. A full-screen
snapshot can include the visible journal. Choose the chart window or move the
journal out of the captured area when it should not appear in the image.

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

## Manual acceptance checks

Use a synthetic chart/test window without personal or employer data.

- Launch with `npm start`; open the bar and verify it is usable above the chart.
- Confirm the journal stays visible when opening the bar, taking a screenshot,
  and selecting a source in the operating system's picker.
- Drag it, click Journal, reopen it, and use × to return without capturing.
- Drag the bar away from the center, take repeated screenshots, and cancel or
  deny a capture. Confirm it returns to the same spot and remains clickable.
- After successful, cancelled, and failed captures, confirm the bar reappears.
  Take another screenshot without reopening it; close it from the journal's
  **Close capture bar** button and then from the bar's **×**. Both controls
  must preserve the preview. Activating the app must not close the bar.
- Take a screen and a window snapshot. Confirm the capture bar is absent and
  the preview is legible. A visible journal may appear in a screen snapshot;
  verify that choosing the chart window excludes it. Note any resolution limit.
- If several sources appear, select one; repeat and cancel selection. The
  earlier preview must survive cancellation.
- Add another screenshot and deny/cancel OS access. The journal must return; an earlier preview
  must remain. Permission prompts may be cached differently by each desktop.
- Remove one of several screenshots; confirm the others remain. Use Start a new setup
  and verify the confirmation. Closing a populated draft must ask before discard.
  Reopen saved Markdown and append another image to that same file; verify its
  old text/images and Markdown backup remain, including after restart.
- Inspect the journal at desktop and minimum window sizes and the bar at its
  fixed size. Verify keyboard focus and actionable errors.
- Capture synthetic light/dark/colored charts with asymmetric toolbars and grid
  lines. Verify exported PNG dimensions and content, including price/time axes.
  Try large drawing zones, identical backgrounds and multiple panes; fallback
  must keep the whole image with a note when no bounds are accepted.
- Select a tiny area, drag in all four directions and beyond image edges, and
  test Escape/Cancel, pointer cancellation and keyboard selection. Verify that
  release adds exactly the selected pixels without another confirmation. Repeat
  on scaled displays and narrow windows, then save/open/append and check images
  at connected folder/OneNote targets using a synthetic account/setup.

Automated checks cover lifecycle, trust boundaries, selection, discard,
cancellation/failure recovery, parallel capture prevention, and pending capture
cleanup. Real capture, layout, permissions, and stacking remain to be tested on
Sway/Wayland, Windows, and macOS. Do not mark those checks complete from mocks.

0.7.3 guided-dark controls use a 680x128 floating window with larger text and
44px buttons. The transparent-during-capture behavior and position preservation
remain in place. Verify text/button fit and screen placement on the target
desktop; the automated lifecycle tests do not establish native geometry.
