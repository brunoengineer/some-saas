import { useSyncExternalStore } from 'react';
import { flushSync } from 'react-dom';

// Whether the browser is printing (Ctrl+P or the PDF button). On `beforeprint`
// the report re-renders synchronously in a paper layout: fixed-width charts,
// light colors, cards that never split across pages.
let printing = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeprint', () => {
    printing = true;
    flushSync(notify);
  });
  window.addEventListener('afterprint', () => {
    printing = false;
    notify();
  });
}

export function usePrinting() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => printing,
  );
}

/** Width of the printable area on A4 portrait with 12 mm margins, in CSS px. */
export const PRINT_WIDTH = 700;
