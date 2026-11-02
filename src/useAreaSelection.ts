import { useEffect, useRef, useState } from 'react';
import type { PointerEvent, KeyboardEvent, SyntheticEvent } from 'react';
import type { CropRectangle } from '../electron/capture-types';

type Point = { x: number; y: number };
const clamp = (n: number) => Math.max(0, Math.min(1, n));

export function selectionRectangle(
  start: Point,
  end: Point,
  width: number,
  height: number,
): CropRectangle | null {
  if (start.x === end.x || start.y === end.y) return null;
  const x = Math.floor(clamp(Math.min(start.x, end.x)) * width + Number.EPSILON * width);
  const y = Math.floor(clamp(Math.min(start.y, end.y)) * height + Number.EPSILON * height);
  const right = Math.ceil(clamp(Math.max(start.x, end.x)) * width - Number.EPSILON * width);
  const bottom = Math.ceil(clamp(Math.max(start.y, end.y)) * height - Number.EPSILON * height);
  return right > x && bottom > y ? { x, y, width: right - x, height: bottom - y } : null;
}

export function useAreaSelection(
  onSelect: (rectangle: CropRectangle) => Promise<void>,
  onCancel: () => void,
) {
  const dialog = useRef<HTMLDialogElement>(null);
  const surface = useRef<SVGSVGElement>(null);
  const anchor = useRef<Point | null>(null);
  const pointer = useRef<number | null>(null);
  const submitting = useRef(false);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [cursor, setCursor] = useState<Point>({ x: 0.25, y: 0.25 });
  const [rectangle, setRectangle] = useState<CropRectangle | null>(null);
  const [error, setError] = useState('');
  const [keyboardActive, setKeyboardActive] = useState(false);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const element = dialog.current!;
    element.showModal();
    return () => {
      element.close();
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  useEffect(() => {
    if (size.width) surface.current?.focus();
  }, [size.width, size.height]);

  function point(event: PointerEvent<SVGSVGElement>): Point {
    const bounds = event.currentTarget.getBoundingClientRect();
    const scale = Math.min(bounds.width / size.width, bounds.height / size.height);
    const width = size.width * scale,
      height = size.height * scale;
    return {
      x: (event.clientX - bounds.left - (bounds.width - width) / 2) / width,
      y: (event.clientY - bounds.top - (bounds.height - height) / 2) / height,
    };
  }
  function move(next: Point) {
    next = { x: clamp(next.x), y: clamp(next.y) };
    setCursor(next);
    if (anchor.current)
      setRectangle(selectionRectangle(anchor.current, next, size.width, size.height));
  }
  async function finish(end: Point) {
    if (!anchor.current || submitting.current) return;
    const selected = selectionRectangle(anchor.current, end, size.width, size.height);
    anchor.current = null;
    if (!selected) {
      setRectangle(null);
      return;
    }
    submitting.current = true;
    setKeyboardActive(false);
    setRectangle(null);
    setError('');
    try {
      await onSelect(selected);
    } catch {
      submitting.current = false;
      setError(
        'The area could not be added. Select again, or cancel; your earlier screenshots are unchanged.',
      );
    }
  }
  function keyboard(event: KeyboardEvent<SVGSVGElement>) {
    if (submitting.current || pointer.current !== null) return;
    setKeyboardActive(true);
    const steps: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    if (steps[event.key]) {
      event.preventDefault();
      const [x, y] = steps[event.key],
        step = event.shiftKey ? 10 : 1;
      move({
        x: clamp(cursor.x + (x * step) / size.width),
        y: clamp(cursor.y + (y * step) / size.height),
      });
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (anchor.current) void finish(cursor);
      else {
        anchor.current = cursor;
        setRectangle(null);
      }
    }
  }

  function cancel() {
    if (!submitting.current) onCancel();
  }
  const surfaceProps = {
    onKeyDown: keyboard,
    onPointerDown(event: PointerEvent<SVGSVGElement>) {
      if (event.button !== 0 || !event.isPrimary || submitting.current) return;
      const start = point(event);
      if (
        !Number.isFinite(start.x) ||
        !Number.isFinite(start.y) ||
        start.x < 0 ||
        start.x > 1 ||
        start.y < 0 ||
        start.y > 1
      )
        return;
      event.preventDefault();
      setKeyboardActive(false);
      event.currentTarget.focus();
      event.currentTarget.setPointerCapture(event.pointerId);
      pointer.current = event.pointerId;
      anchor.current = start;
      move(anchor.current);
      setRectangle(null);
    },
    onPointerMove(event: PointerEvent<SVGSVGElement>) {
      if (event.pointerId === pointer.current) move(point(event));
    },
    onPointerUp(event: PointerEvent<SVGSVGElement>) {
      if (event.pointerId !== pointer.current) return;
      pointer.current = null;
      void finish(point(event));
    },
    onPointerCancel() {
      pointer.current = null;
      anchor.current = null;
      setRectangle(null);
    },
    onLostPointerCapture() {
      if (pointer.current !== null) {
        pointer.current = null;
        anchor.current = null;
        setRectangle(null);
      }
    },
  };
  function loadImage(event: SyntheticEvent<HTMLImageElement>) {
    setSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight });
  }
  function imageError() {
    setError('The capture could not be displayed. Cancel and take another screenshot.');
  }
  return {
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
  };
}
