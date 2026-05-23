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
          className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider"
        >
          {label}
        </label>
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`
            w-full px-4 py-3 rounded-none
            bg-black/30 backdrop-blur-sm text-[var(--text-primary)]
            border transition-all duration-150 uppercase tracking-[0.1em]
            placeholder:text-[var(--text-tertiary)] placeholder:normal-case
            focus:outline-none focus:ring-0
            ${
              error
                ? 'border-[var(--pace-danger)] focus:border-[var(--pace-danger)] shadow-[0_0_10px_rgba(255,69,58,0.2)]'
                : 'border-[var(--text-secondary)] focus:border-white shadow-[0_0_15px_rgba(255,255,255,0.05)]'
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
