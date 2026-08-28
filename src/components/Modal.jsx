import { X } from 'lucide-react';

export default function Modal({ title, children, onClose, wide = false }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <h2>{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label="Close dialog"><X /></button>
        </header>
        {children}
      </section>
    </div>
  );
}
