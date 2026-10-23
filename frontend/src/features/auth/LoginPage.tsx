import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { FormField, Input } from '@/components/ui/Field';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { login } from './auth.service';
import { EMAIL_MAX_LENGTH, PASSWORD_MAX_LENGTH } from './auth.constants';
import { useAuthStore } from '@/stores/authStore';
import { useToast } from '@/stores/toastStore';
import { errorMessage } from '@/utils/errorMessage';

export function LoginPage() {
  const setAccessToken = useAuthStore((s) => s.setAccessToken);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  useDocumentTitle('Entrar');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await login({ email, password });
      toast.success('Você entrou com sucesso.');
      // O GuestOnly redireciona (rota de origem quando vale para este usuário, senão a home).
      setAccessToken(res.access_token);
    } catch (err) {
      // A mensagem da API (ex.: 'Credenciais inválidas.', 429, validação) vence o texto genérico.
      setError(errorMessage(err, 'Falha ao entrar. Verifique e-mail e senha.', { anonymous: true }));
      setLoading(false);
    }
  }

  return (
    <section className="flex w-full flex-col gap-6">
      <h1 className="text-title font-semibold text-slate-900">Entrar</h1>
      {/* Erro antigo some ao editar e quando o navegador barra o envio (campo obrigatorio vazio). */}
      <form onSubmit={onSubmit} onInvalidCapture={() => setError(null)} className="flex flex-col gap-4">
        <FormField label="E-mail" htmlFor="email">
          <Input
            id="email"
            type="email"
            autoComplete="username"
            required
            maxLength={EMAIL_MAX_LENGTH}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(null);
            }}
          />
        </FormField>
        <FormField label="Senha" htmlFor="password">
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            maxLength={PASSWORD_MAX_LENGTH}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(null);
            }}
          />
        </FormField>
        {error ? <Alert>{error}</Alert> : null}
        <Button type="submit" loading={loading} loadingLabel="Entrando…" className="w-full">
          Entrar
        </Button>
      </form>
      <p className="text-body text-slate-600">
        Não tem conta?{' '}
        <Link to="/register" className="text-slate-900 underline">
          Cadastrar
        </Link>
      </p>
    </section>
  );
}
