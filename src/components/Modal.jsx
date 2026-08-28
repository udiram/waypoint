import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';

export default function Modal({ title, children, onClose, wide = false }) {
  const closeRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    closeRef.current?.focus();
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <h2>{title}</h2>
          <button ref={closeRef} className="icon-button" onClick={onClose} aria-label="Close dialog"><X /></button>
        </header>
        {children}
      </section>
    </div>
  );
}
