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
    keyboardActive,
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
          <h2 id="area-title">
            {source.editing ? 'Edit image · Select an area' : 'Select an area'}
          </h2>
          <p id="area-help">
            {source.editing
              ? 'Drag and release to crop this draft image. Escape keeps it unchanged.'
              : 'Drag and release to add only this area. Escape cancels.'}
          </p>
        </div>
        <button className="secondary-button" type="button" onClick={cancel}>
          Cancel
        </button>
      </div>
      <div className="area-stage">
        <img
          hidden
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
            preserveAspectRatio="xMidYMid meet"
            tabIndex={0}
            role="group"
            aria-label="Capture area"
            aria-describedby="area-keyboard"
            {...surfaceProps}
          >
            <image href={source.image} x={0} y={0} width={size.width} height={size.height} />
            {rectangle && <rect className="area-rectangle" {...rectangle} />}
            {keyboardActive && (
              <path
                className="area-cursor"
                d={`M ${cursor.x * size.width - 8} ${cursor.y * size.height} h 16 M ${cursor.x * size.width} ${cursor.y * size.height - 8} v 16`}
              />
            )}
          </svg>
        )}
      </div>
      <p id="area-keyboard" className="area-help">
        Keyboard: arrow keys move, Shift moves faster. Enter marks the first corner; Enter again{' '}
        {source.editing ? 'applies the crop.' : 'adds the area.'}
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
