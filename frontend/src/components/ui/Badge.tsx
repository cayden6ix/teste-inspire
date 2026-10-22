import type { ReactNode } from 'react';

export type BadgeTone = 'slate' | 'blue' | 'amber' | 'green' | 'red' | 'violet';

const TONES: Record<BadgeTone, string> = {
  slate: 'bg-slate-100 text-slate-700',
  blue: 'bg-blue-50 text-blue-700',
  amber: 'bg-amber-50 text-amber-700',
  green: 'bg-emerald-50 text-emerald-700',
  red: 'bg-red-50 text-red-700',
  violet: 'bg-violet-50 text-violet-700',
};

type BadgeProps = {
  tone?: BadgeTone;
  children: ReactNode;
};

export function Badge({ tone = 'slate', children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}
