import type { Screenshot } from '../electron/capture-types';
import { TIMEFRAME_PATTERN, TIMEFRAMES, validTimeframe } from '../electron/form-schema';

export function ScreenshotFields({ screenshot, busy, onTimeframe, onCaption }: {
  screenshot: Screenshot; busy: boolean; onTimeframe(value: string): void; onCaption(value: string): void;
}) {
  const list = `timeframes-${screenshot.id}`;
  return <div className="screenshot-fields">
    <label className="screenshot-caption">Timeframe (required)
      <input list={list} required maxLength={5} pattern={TIMEFRAME_PATTERN} spellCheck={false} autoComplete="off"
        disabled={busy} value={screenshot.timeframe} placeholder="1m, 2m, 1h…"
        aria-invalid={!!screenshot.timeframe && !validTimeframe(screenshot.timeframe)} onChange={(event) => onTimeframe(event.target.value)} />
      <datalist id={list}>{TIMEFRAMES.map((value) => <option key={value} value={value} />)}</datalist>
    </label>
    <label className="screenshot-caption">Caption (optional)
      <input maxLength={200} disabled={busy} value={screenshot.caption} placeholder="Entry, follow-up, exit…" onChange={(event) => onCaption(event.target.value)} />
    </label>
  </div>;
}
