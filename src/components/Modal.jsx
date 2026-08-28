import { X } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';

export default function Modal({ title, children, onClose, wide = false }) {
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const dialog = dialogRef.current;
    const focusableSelector = [
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',');

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !dialog) return;
      const focusable = [...dialog.querySelectorAll(focusableSelector)].filter((element) => element.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    const animationFrame = window.requestAnimationFrame(() => {
      const initial = dialog?.querySelector('[data-modal-autofocus], [autofocus]')
        || dialog?.querySelector('input:not([disabled])')
        || closeRef.current;
      initial?.focus();
    });
    return () => {
      window.cancelAnimationFrame(animationFrame);
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus?.();
    };
  }, []);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={() => onCloseRef.current()}>
      <section ref={dialogRef} className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId} onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <h2 id={titleId}>{title}</h2>
          <button ref={closeRef} className="icon-button" onClick={() => onCloseRef.current()} aria-label="Close dialog"><X /></button>
        </header>
        {children}
      </section>
    </div>
  );
}
