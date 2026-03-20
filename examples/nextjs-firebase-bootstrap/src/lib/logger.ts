/**
 * src/lib/logger.ts — Structured logger (Pino)
 *
 * JSON in production (Vercel log drain compatible).
 * Pretty-printed in development.
 *
 * Usage:
 *   logger.info({ userId }, 'User signed in');
 *   logger.error({ err, orderId }, 'Order creation failed');
 *
 * Never log: passwords, tokens, card numbers, full PII.
 * Always log: user IDs (not emails), action names, error objects.
 */
import pino from 'pino';

const isDev = process.env.NODE_ENV === 'development';

export const logger = pino({
  level: isDev ? 'debug' : 'info',
  ...(isDev && {
    transport: {
      target:  'pino-pretty',
      options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
    },
  }),
  redact: {
    // Strip sensitive fields before logging — even in dev
    paths:  ['password', 'token', 'secret', 'cardNumber', 'cvv', '*.password', '*.token'],
    censor: '[REDACTED]',
  },
  base: {
    env: process.env.NEXT_PUBLIC_ENV,
  },
});
