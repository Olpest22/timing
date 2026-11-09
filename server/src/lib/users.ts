import type { User } from '@prisma/client';

/** Данные пользователя, которые можно отдавать клиенту (без хеша пароля). */
export function publicUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    timezone: user.timezone,
    theme: user.theme,
  };
}

export type PublicUser = ReturnType<typeof publicUser>;
