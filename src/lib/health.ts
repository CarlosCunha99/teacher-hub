export const HEALTH_STATUS = "ok" as const;

export type HealthStatus = typeof HEALTH_STATUS;

export type HealthPayload = { status: HealthStatus };
