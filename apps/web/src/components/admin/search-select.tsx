"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

type SearchSelectOption = {
  id: string;
  label: string;
  description?: string;
};

export function AdminSearchSelect({
  label,
  placeholder,
  valueLabel,
  options,
  isLoading,
  search,
  onSearchChange,
  onSelect,
  onClear,
  emptyText = "No matches",
  hint,
}: {
  label: string;
  placeholder: string;
  valueLabel: string | null;
  options: SearchSelectOption[];
  isLoading: boolean;
  search: string;
  onSearchChange: (next: string) => void;
  onSelect: (id: string) => void;
  onClear: () => void;
  emptyText?: string;
  hint?: ReactNode;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  return (
    <div ref={rootRef} className="relative block sm:col-span-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        {valueLabel ? (
          <button
            type="button"
            className="text-xs font-semibold text-brand-blue-dark hover:underline"
            onClick={() => {
              onClear();
              onSearchChange("");
              setOpen(true);
            }}
          >
            Change
          </button>
        ) : null}
      </div>

      {valueLabel ? (
        <div className="mt-1 rounded-xl border border-brand-blue/20 bg-brand-mist/40 px-3 py-2 text-sm text-slate-900">
          {valueLabel}
        </div>
      ) : (
        <input
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
          value={search}
          placeholder={placeholder}
          autoComplete="off"
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            onSearchChange(e.target.value);
            setOpen(true);
          }}
        />
      )}

      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}

      {open && !valueLabel ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-panel"
        >
          {isLoading ? (
            <li className="px-3 py-2 text-sm text-slate-500">Searching…</li>
          ) : !options.length ? (
            <li className="px-3 py-2 text-sm text-slate-500">{emptyText}</li>
          ) : (
            options.map((opt) => (
              <li key={opt.id}>
                <button
                  type="button"
                  role="option"
                  className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-slate-50"
                  onClick={() => {
                    onSelect(opt.id);
                    setOpen(false);
                  }}
                >
                  <span className="text-sm font-medium text-slate-900">{opt.label}</span>
                  {opt.description ? (
                    <span className="text-xs text-slate-500">{opt.description}</span>
                  ) : null}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
