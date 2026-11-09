export type User = {
  id: number;
  name: string;
  email: string | null;
  timezone: string;
};

export type AuthResponse = { token: string; user: User };

export type RegisterInput = { name: string; email: string; password: string };
