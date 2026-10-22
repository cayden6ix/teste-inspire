import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

const FIELD_CLASS =
  'w-full rounded border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500 disabled:bg-slate-50 disabled:text-slate-500';

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className = '', ...props }: InputProps) {
  return <input {...props} className={`${FIELD_CLASS} ${className}`} />;
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export function Select({ className = '', ...props }: SelectProps) {
  return <select {...props} className={`${FIELD_CLASS} ${className}`} />;
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export function Textarea({ className = '', ...props }: TextareaProps) {
  return <textarea {...props} className={`${FIELD_CLASS} ${className}`} />;
}
