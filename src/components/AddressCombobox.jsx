import { Check, LoaderCircle, MapPin } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { searchPlaces } from '../lib/api';

export default function AddressCombobox({
  id,
  label,
  value,
  onValueChange,
  onSelect,
  placeholder,
  selectedLabel,
  autoFocus = false,
}) {
  const listId = useId();
  const rootRef = useRef(null);
  const requestRef = useRef(0);
  const skipNextSearchRef = useRef(false);
  const [suggestions, setSuggestions] = useState([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState('idle');

  useEffect(() => {
    const query = value.trim();
    if (skipNextSearchRef.current) {
      skipNextSearchRef.current = false;
      setOpen(false);
      setStatus('idle');
      return undefined;
    }
    if (query.length < 3 || query === selectedLabel) {
      setSuggestions([]);
      setActiveIndex(-1);
      setOpen(false);
      setStatus('idle');
      return undefined;
    }

    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setStatus('loading');
    const timeoutId = window.setTimeout(() => {
      searchPlaces(query)
        .then((results) => {
          if (requestRef.current !== requestId) return;
          setSuggestions(results);
          setActiveIndex(results.length ? 0 : -1);
          setOpen(true);
          setStatus(results.length ? 'ready' : 'empty');
        })
        .catch(() => {
          if (requestRef.current !== requestId) return;
          setSuggestions([]);
          setActiveIndex(-1);
          setOpen(true);
          setStatus('error');
        });
    }, 420);

    return () => window.clearTimeout(timeoutId);
  }, [selectedLabel, value]);

  const choose = (place) => {
    skipNextSearchRef.current = true;
    onSelect(place);
    setSuggestions([]);
    setActiveIndex(-1);
    setOpen(false);
    setStatus('idle');
  };

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!open && suggestions.length) setOpen(true);
      setActiveIndex((current) => Math.min(suggestions.length - 1, current + 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => Math.max(0, current - 1));
    } else if (event.key === 'Enter' && open && activeIndex >= 0) {
      event.preventDefault();
      choose(suggestions[activeIndex]);
    } else if (event.key === 'Escape' && open) {
      event.stopPropagation();
      setOpen(false);
    }
  };

  const message = status === 'loading'
    ? 'Searching addresses'
    : status === 'empty'
      ? 'No matching addresses'
      : status === 'error'
        ? 'Address search is temporarily unavailable'
        : selectedLabel && value === selectedLabel
          ? 'Address selected'
          : '';

  return (
    <div
      className="address-field"
      ref={rootRef}
      onBlur={(event) => {
        if (!rootRef.current?.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <label htmlFor={id}>{label}</label>
      <div className="address-input-wrap">
        <MapPin aria-hidden="true" />
        <input
          id={id}
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          onFocus={() => suggestions.length && setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck="false"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
          data-modal-autofocus={autoFocus ? '' : undefined}
        />
        {status === 'loading' && <LoaderCircle className="address-spinner" aria-hidden="true" />}
        {selectedLabel && value === selectedLabel && status !== 'loading' && <Check className="address-selected" aria-hidden="true" />}
      </div>
      {open && (
        <div className="address-results" id={listId} role="listbox" aria-label={`${label} suggestions`}>
          {suggestions.map((place, index) => (
            <div
              id={`${listId}-${index}`}
              key={`${place.latitude}:${place.longitude}:${place.label}`}
              className={index === activeIndex ? 'active' : ''}
              role="option"
              aria-selected={index === activeIndex}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => choose(place)}
            >
              <MapPin aria-hidden="true" />
              <span><strong>{place.shortLabel}</strong><small>{place.label}</small></span>
            </div>
          ))}
          {!suggestions.length && status !== 'loading' && <p>{message}</p>}
        </div>
      )}
      <span className="address-status" aria-live="polite">{message}</span>
    </div>
  );
}
