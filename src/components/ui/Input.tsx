'use client';

import { memo, useId, type InputHTMLAttributes } from 'react';

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

export const Input = memo(function Input({
  label,
  value,
  onChange,
  error,
  className = '',
  ...props
}: InputProps) {
  const id = useId();

  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={id}
        className="text-sm font-medium text-[var(--text-secondary)]"
      >
        {label}
      </label>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`
          w-full px-4 py-3 rounded-xl
          bg-[var(--bg-tertiary)] text-[var(--text-primary)]
          border transition-colors duration-150
          placeholder:text-[var(--text-tertiary)]
          focus:outline-none focus:ring-2 focus:ring-offset-2
          focus:ring-offset-[var(--bg-primary)]
          ${
            error
              ? 'border-[var(--pace-danger)] focus:ring-[var(--pace-danger)]'
              : 'border-[var(--surface-border)] focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)]'
          }
          ${className}
        `}
        {...props}
      />
      {error && (
        <p className="text-sm text-[var(--pace-danger)]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
});
