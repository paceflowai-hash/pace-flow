'use client';

import { memo } from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends HTMLMotionProps<'button'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  fullWidth?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'border border-[var(--text-primary)] bg-transparent text-[var(--text-primary)] hover:bg-[var(--text-primary)] hover:text-black uppercase tracking-[0.15em] backdrop-blur-md',
  secondary:
    'border border-[var(--bg-tertiary)] bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:border-[var(--text-secondary)] uppercase tracking-[0.1em]',
  ghost:
    'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] uppercase tracking-[0.15em]',
  danger:
    'border border-[var(--pace-danger)] bg-transparent text-[var(--pace-danger)] hover:bg-[var(--pace-danger)] hover:text-white uppercase tracking-[0.15em]',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-6 py-2 text-xs',
  md: 'px-8 py-3 text-sm',
  lg: 'px-12 py-4 text-sm',
};

export const Button = memo(function Button({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  fullWidth = false,
  disabled,
  className = '',
  ...props
}: ButtonProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className={`
        inline-flex items-center justify-center font-medium
        transition-colors duration-150
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-primary)]
        disabled:opacity-50 disabled:pointer-events-none
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <svg
          className="animate-spin h-5 w-5"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-label="Yükleniyor"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      ) : (
        children
      )}
    </motion.button>
  );
});
