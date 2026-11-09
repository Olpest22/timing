import { randomInt } from 'node:crypto';

// Без похожих символов (0/O, 1/l/I), чтобы код можно было продиктовать
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

/** Код для ссылки-приглашения: /e/k7mq2xra */
export function generateEventCode(length = 8): string {
  return Array.from({ length }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
}
