import { createPortal } from 'react-dom';
import type { CaptureSource, CropRectangle } from '../electron/capture-types';
import { useAreaSelection } from './useAreaSelection';

export function AreaSelection({
  source,
  onSelect,
  onCancel,
}: {
  source: CaptureSource;
  onSelect(rectangle: CropRectangle): Promise<void>;
  onCancel(): void;
}) {
  const {
    dialog,
    surface,
    size,
    cursor,
    rectangle,
    error,
    cancel,
    surfaceProps,
    loadImage,
    imageError,
  } = useAreaSelection(onSelect, onCancel);
  return createPortal(
    <dialog
      ref={dialog}
      className="area-dialog"
      aria-labelledby="area-title"
      aria-describedby="area-help"
      onCancel={(event) => {
        event.preventDefault();
        cancel();
      }}
    >
      <div className="preview-heading">
        <div>
          <h2 id="area-title">Select an area</h2>
          <p id="area-help">Drag and release to add only this area. Escape cancels.</p>
        </div>
        <button className="secondary-button" type="button" onClick={cancel}>
          Cancel
        </button>
      </div>
      <div
        className="area-stage"
        style={
          size.width
            ? { width: `min(100%, ${size.width}px, calc(60vh * ${size.width / size.height}))` }
            : undefined
        }
      >
        <img
          src={source.image}
          alt="Captured source for area selection"
          draggable={false}
          onLoad={loadImage}
          onError={imageError}
        />
        {!!size.width && (
          <svg
            ref={surface}
            className="area-surface"
            viewBox={`0 0 ${size.width} ${size.height}`}
            preserveAspectRatio="none"
            tabIndex={0}
            role="group"
            aria-label="Capture area"
            aria-describedby="area-keyboard"
            {...surfaceProps}
          >
            {rectangle && <rect className="area-rectangle" {...rectangle} />}
            <path
              className="area-cursor"
              d={`M ${cursor.x * size.width - 8} ${cursor.y * size.height} h 16 M ${cursor.x * size.width} ${cursor.y * size.height - 8} v 16`}
            />
          </svg>
        )}
      </div>
      <p id="area-keyboard" className="area-help">
        Keyboard: arrow keys move, Shift moves faster. Enter marks the first corner; Enter again
        adds the area.
      </p>
      <p className="area-help" role="status">
        {rectangle
          ? `${rectangle.width} × ${rectangle.height} pixels`
          : 'Choose any part of the captured image.'}
      </p>
      {error && <p role="alert">{error}</p>}
    </dialog>,
    document.body,
  );
}
