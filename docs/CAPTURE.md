# Capture prototype

## Implemented flow

1. Click **Capture chart** in the desktop journal. The main window stays visible and a
   compact, draggable **TradeFrame Capture** bar opens.
2. Click **Screenshot** on the bar. TradeFrame hides only the capture bar, waits
   briefly for the compositor, then requests screen/window snapshots from Electron.
   The journal stays visible, including while the operating system's source picker is open.
3. On PipeWire, the operating system may prompt for a screen/window. If only one
   image is returned, it becomes the preview directly. When multiple sources
   are returned, choose a snapshot in the journal.
4. **Cancel selection** preserves an earlier preview. **Discard** on a preview
   removes it. **Retake screenshot** returns to the floating controls; a failed
   or cancelled capture leaves the earlier preview intact.
5. **Journal** or **×** on the bar returns to the journal without taking a shot.

This is a single-snapshot prototype, not a recorder. Images and window titles
stay in application memory; they are not saved or transmitted. All candidate
snapshots are collected at capture time and discarded after selection. Closing
the journal clears the preview; it is not a saved setup. There is no global
shortcut, annotation, crop tool, setup form, or persistence yet.

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
- Take a screen and a window snapshot. Confirm the capture bar is absent and
  the preview is legible. A visible journal may appear in a screen snapshot;
  verify that choosing the chart window excludes it. Note any resolution limit.
- If several sources appear, select one; repeat and cancel selection. The
  earlier preview must survive cancellation.
- Retake and deny/cancel OS access. The journal must return; an earlier preview
  must remain. Permission prompts may be cached differently by each desktop.
- Discard the preview; reopen the app and confirm nothing was persisted.
- Inspect the journal at desktop and minimum window sizes and the bar at its
  fixed size. Verify keyboard focus and actionable errors.

Automated checks cover lifecycle, trust boundaries, selection, discard,
cancellation/failure recovery, parallel capture prevention, and pending capture
cleanup. Real capture, layout, permissions, and stacking remain to be tested on
Sway/Wayland, Windows, and macOS. Do not mark those checks complete from mocks.
