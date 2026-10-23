import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { FormField, Input } from '@/components/ui/Field';
import { login } from './auth.service';
import { useAuthStore } from '@/stores/authStore';
import { useToast } from '@/stores/toastStore';
import { errorMessage } from '@/utils/errorMessage';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const setAccessToken = useAuthStore((s) => s.setAccessToken);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await login({ email, password });
      setAccessToken(res.access_token);
      toast.success('Você entrou com sucesso.');
      // Volta para a rota que exigiu login (so caminhos internos).
      const from = (location.state as { from?: unknown } | null)?.from;
      navigate(typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') ? from : '/', {
        replace: true,
      });
    } catch (err) {
      // A mensagem da API (ex.: 'Credenciais inválidas.', 429, validação) vence o texto genérico.
      setError(errorMessage(err, 'Falha ao entrar. Verifique e-mail e senha.', { anonymous: true }));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="flex w-full flex-col gap-6">
      <h1 className="text-title font-semibold text-slate-900">Entrar</h1>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <FormField label="E-mail" htmlFor="email">
          <Input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </FormField>
        <FormField label="Senha" htmlFor="password">
          <Input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
