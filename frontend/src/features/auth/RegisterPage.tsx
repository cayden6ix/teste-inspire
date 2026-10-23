import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { FormField, Input } from '@/components/ui/Field';
import { register } from './auth.service';
import { useAuthStore } from '@/stores/authStore';
import { useToast } from '@/stores/toastStore';
import { errorMessage } from '@/utils/errorMessage';

export function RegisterPage() {
  const navigate = useNavigate();
  const setAccessToken = useAuthStore((s) => s.setAccessToken);
  const [name, setName] = useState('');
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
      const res = await register({ name, email, password });
      setAccessToken(res.access_token);
      toast.success('Conta criada com sucesso.');
      navigate('/');
    } catch (err) {
      // A mensagem da API (ex.: 409 'Este e-mail já está cadastrado.', 429, validação) vence o texto genérico.
      setError(errorMessage(err, 'Falha ao cadastrar. Verifique os dados.', { anonymous: true }));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="flex w-full flex-col gap-6">
      <h1 className="text-title font-semibold text-slate-900">Cadastrar</h1>
      <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2">
        <FormField label="Nome" htmlFor="name">
          <Input
            id="name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </FormField>
        <FormField label="E-mail" htmlFor="email">
          <Input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </FormField>
        <FormField label="Senha (mínimo 6)" htmlFor="password" className="md:col-span-2">
          <Input
            id="password"
            type="password"
            minLength={6}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
