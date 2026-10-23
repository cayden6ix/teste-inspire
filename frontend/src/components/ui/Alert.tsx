import type { ReactNode } from 'react';

type AlertProps = {
  tone?: 'error' | 'info' | 'success';
  children: ReactNode;
};

const TONES = {
  error: 'border-red-200 bg-red-50 text-red-700',
  info: 'border-blue-200 bg-blue-50 text-blue-700',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
};

export function Alert({ tone = 'error', children }: AlertProps) {
  return (
    <p
      className={`rounded-control border px-4 py-3 text-body ${TONES[tone]}`}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      {children}
    </p>
  );
}
