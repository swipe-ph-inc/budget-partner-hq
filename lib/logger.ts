type LogLevel = "error" | "warn" | "info";

function emit(level: LogLevel, scope: string, message: string, meta?: Record<string, unknown>) {
  const payload = {
    level,
    scope,
    message,
    t: new Date().toISOString(),
    ...meta,
  };
  const line = JSON.stringify(payload);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

/** Structured JSON logs for aggregators (Datadog, Vercel, etc.). */
export function logError(scope: string, message: string, meta?: Record<string, unknown>) {
  emit("error", scope, message, meta);
}

export function logWarn(scope: string, message: string, meta?: Record<string, unknown>) {
  emit("warn", scope, message, meta);
}

export function logInfo(scope: string, message: string, meta?: Record<string, unknown>) {
  emit("info", scope, message, meta);
}
