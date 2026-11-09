export type User = {
  id: number;
  name: string;
  email: string | null;
  timezone: string;
  theme: string;
  /** Вошёл по ссылке только с именем, без email и пароля */
  isGuest: boolean;
};

export type AuthResponse = { token: string; user: User };

export type RegisterInput = { name: string; email: string; password: string };
