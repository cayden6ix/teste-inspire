import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { FormField, Input } from '@/components/ui/Field';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { register } from './auth.service';
import {
  EMAIL_MAX_LENGTH,
  NAME_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from './auth.constants';
import { useAuthStore } from '@/stores/authStore';
import { useToast } from '@/stores/toastStore';
import { errorMessage } from '@/utils/errorMessage';

export function RegisterPage() {
  const setAccessToken = useAuthStore((s) => s.setAccessToken);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  useDocumentTitle('Cadastrar');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await register({ name, email, password });
      toast.success('Conta criada com sucesso.');
      // O GuestOnly leva para a home assim que a sessao existe.
      setAccessToken(res.access_token);
    } catch (err) {
      // A mensagem da API (ex.: 409 'Este e-mail já está cadastrado.', 429, validação) vence o texto genérico.
      setError(errorMessage(err, 'Falha ao cadastrar. Verifique os dados.', { anonymous: true }));
      setLoading(false);
    }
  }

  return (
    <section className="flex w-full flex-col gap-6">
      <h1 className="text-title font-semibold text-slate-900">Cadastrar</h1>
      {/* Erro antigo some ao editar e quando o navegador barra o envio (campo obrigatorio vazio). */}
      <form onSubmit={onSubmit} onInvalidCapture={() => setError(null)} className="grid gap-4 md:grid-cols-2">
        <FormField label="Nome" htmlFor="name">
          <Input
            id="name"
            type="text"
            autoComplete="name"
            required
            maxLength={NAME_MAX_LENGTH}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
          />
        </FormField>
        <FormField label="E-mail" htmlFor="email">
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            maxLength={EMAIL_MAX_LENGTH}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(null);
            }}
          />
        </FormField>
        <FormField
          label={`Senha (${PASSWORD_MIN_LENGTH} a ${PASSWORD_MAX_LENGTH} caracteres)`}
          htmlFor="password"
          className="md:col-span-2"
        >
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            minLength={PASSWORD_MIN_LENGTH}
            maxLength={PASSWORD_MAX_LENGTH}
            required
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(null);
            }}
          />
        </FormField>
        {error ? (
          <div className="md:col-span-2">
            <Alert>{error}</Alert>
          </div>
        ) : null}
        <Button type="submit" loading={loading} loadingLabel="Cadastrando…" className="w-full md:col-span-2">
          Cadastrar
        </Button>
      </form>
      <p className="text-body text-slate-600">
        Já tem conta?{' '}
        <Link to="/login" className="text-slate-900 underline">
          Entrar
        </Link>
      </p>
    </section>
  );
}
