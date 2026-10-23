import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { Spinner } from './Spinner';

/**
 * Campo de formulario: Input, Select e Textarea tem a mesma altura de controle (h-control,
 * igual a do Button), o mesmo padding e a mesma fonte em formularios, barras de filtro e linhas.
 */
const FIELD_CLASS =
  'w-full rounded-control border border-slate-300 bg-white px-3 text-body text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50 disabled:text-slate-500';

const CONTROL_CLASS = `${FIELD_CLASS} h-control`;

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className = '', ...props }: InputProps) {
  return <input {...props} className={`${CONTROL_CLASS} ${className}`} />;
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  /**
   * Alteracao em andamento (PATCH disparado pelo proprio select): desabilita o campo e mostra um
   * spinner discreto ao lado da seta, sem mudar o tamanho. Passe sempre um booleano em selects de
   * linha (a presenca da prop mantem o mesmo elemento entre os estados, sem perder o foco).
   */
  saving?: boolean;
};

export function Select({ className = '', saving, disabled, ...props }: SelectProps) {
  if (saving === undefined) {
    return <select {...props} disabled={disabled} className={`${CONTROL_CLASS} ${className}`} />;
  }

  return (
    <div className="relative w-full">
      <select
        {...props}
        disabled={disabled || saving}
        aria-busy={saving || undefined}
        className={`${CONTROL_CLASS} ${className}`}
      />
      {saving && (
        <span className="pointer-events-none absolute right-8 top-1/2 -translate-y-1/2 text-slate-500">
          <Spinner label="Salvando…" />
        </span>
      )}
    </div>
  );
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

/** Varias linhas: padding vertical de 8px e nunca menor que a altura de controle. */
export function Textarea({ className = '', ...props }: TextareaProps) {
  return <textarea {...props} className={`${FIELD_CLASS} min-h-control py-2 ${className}`} />;
}

type FormFieldProps = {
  label: string;
  htmlFor: string;
  hint?: string;
  children: ReactNode;
  className?: string;
};

/** Rotulo + controle de formulario, com o mesmo espacamento em todos os formularios. */
export function FormField({ label, htmlFor, hint, children, className = '' }: FormFieldProps) {
  return (
    <div className={className}>
      <label className="mb-2 block text-label font-medium text-slate-700" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint && <p className="mt-2 text-caption text-slate-500">{hint}</p>}
    </div>
  );
}
