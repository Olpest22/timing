import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../auth/context';
import { Button } from '../components/Button';
import { Field, FormError } from '../components/form';
import { ApiError } from '../lib/api';
import { AuthCard } from './AuthCard';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    if (form.password !== form.confirm) {
      setFieldErrors({ confirm: 'Пароли не совпадают' });
      return;
    }

    setSubmitting(true);
    try {
      await register({ name: form.name, email: form.email, password: form.password });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fields).length > 0) {
        setFieldErrors(err.fields);
      } else {
        setError(err instanceof ApiError ? err.message : 'Не удалось зарегистрироваться');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthCard
      title="Регистрация"
      footer={
        <>
          Уже есть аккаунт?{' '}
          <Link to="/login" className="ui-link ui-focus font-bold text-on-canvas">
            Войти
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <FormError message={error} />
        <Field
          label="Имя"
          name="name"
          autoComplete="name"
          required
          value={form.name}
          onChange={set('name')}
          error={fieldErrors.name}
        />
        <Field
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={form.email}
          onChange={set('email')}
          error={fieldErrors.email}
        />
        <Field
          label="Пароль"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          value={form.password}
          onChange={set('password')}
          error={fieldErrors.password}
          hint="Не короче 6 символов"
        />
        <Field
          label="Повторите пароль"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          value={form.confirm}
          onChange={set('confirm')}
          error={fieldErrors.confirm}
        />
        <Button type="submit" pending={submitting} pendingLabel="Создаём" className="w-full">
          Создать аккаунт
        </Button>
      </form>
    </AuthCard>
  );
}
