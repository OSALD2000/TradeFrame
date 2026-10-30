# Capture prototype

## Implemented flow

1. Click **Capture chart** in the desktop journal. The main window stays visible and a
   compact, draggable **TradeFrame Capture** bar opens.
2. Click **Screenshot** on the bar. TradeFrame makes the capture bar transparent
   and ignores mouse input there, waits briefly for the compositor, then requests
   screen/window snapshots from Electron. The native bar remains mapped so it
   retains its dragged position rather than being placed again by Wayland.
   The journal stays visible, including while the operating system's source picker is open.
3. On PipeWire, the operating system may prompt for a screen/window. If only one
   image is returned, it is added to the current setup directly. When multiple sources
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
shortcut, annotation, or crop tool yet.

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
- Remove one of several screenshots; confirm the others remain. Start New setup
  and verify the confirmation. Closing a populated draft must ask before discard.
  Reopen saved Markdown and append another image to that same file; verify its
  old text/images and Markdown backup remain, including after restart.
- Inspect the journal at desktop and minimum window sizes and the bar at its
  fixed size. Verify keyboard focus and actionable errors.

Automated checks cover lifecycle, trust boundaries, selection, discard,
cancellation/failure recovery, parallel capture prevention, and pending capture
cleanup. Real capture, layout, permissions, and stacking remain to be tested on
Sway/Wayland, Windows, and macOS. Do not mark those checks complete from mocks.
