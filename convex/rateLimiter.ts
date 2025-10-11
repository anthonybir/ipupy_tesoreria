import { RateLimiter, MINUTE, HOUR } from "@convex-dev/rate-limiter";
import type { MutationCtx } from "./_generated/server";
import { components } from "./_generated/api";
import { ConvexError } from "convex/values";

const limitConfig = {
  authLogin: {
    kind: "fixed window",
    period: 15 * MINUTE,
    rate: 5,
  },
  adminActions: {
    kind: "fixed window",
    period: MINUTE,
    rate: 30,
  },
  reportCreate: {
    kind: "fixed window",
    period: HOUR,
    rate: 10,
  },
  transactionCreate: {
    kind: "fixed window",
    period: MINUTE,
    rate: 60,
    capacity: 20,
  },
} as const;

export type RateLimitName = keyof typeof limitConfig;

export const rateLimiter = new RateLimiter(components.rateLimiter, limitConfig);

const rateLimitMessages: Record<RateLimitName, string> = {
  authLogin: "Demasiados intentos de acceso. Intente nuevamente en unos minutos.",
  adminActions: "Acción administrativa limitada temporalmente. Espere un momento e intente otra vez.",
  reportCreate: "Ha alcanzado el límite de envíos de informes. Intente más tarde.",
  transactionCreate: "Ha alcanzado el límite de registros de transacciones. Intente nuevamente en breve.",
};

export async function enforceRateLimit(
  ctx: MutationCtx,
  name: RateLimitName,
  key?: string
): Promise<void> {
  const status = await rateLimiter.limit(ctx, name, key ? { key } : {});

  if (!status.ok) {
    throw new ConvexError({
      kind: "RateLimited",
      name,
      retryAfter: status.retryAfter,
      message: rateLimitMessages[name],
    });
  }
}
