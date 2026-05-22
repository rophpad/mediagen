type LogLevel = "debug" | "info" | "warn" | "error";

type LogContext = Record<string, unknown>;

const SENSITIVE_KEY_PATTERN =
  /authorization|api[-_]?key|token|secret|password|cookie|set-cookie/i;

export function createRequestId() {
  return crypto.randomUUID();
}

export function createLogger(scope: string, baseContext: LogContext = {}) {
  return {
    debug(message: string, context?: LogContext) {
      writeLog("debug", scope, message, baseContext, context);
    },
    info(message: string, context?: LogContext) {
      writeLog("info", scope, message, baseContext, context);
    },
    warn(message: string, context?: LogContext) {
      writeLog("warn", scope, message, baseContext, context);
    },
    error(message: string, context?: LogContext) {
      writeLog("error", scope, message, baseContext, context);
    },
  };
}

export function serializeError(error: unknown): LogContext {
  if (!(error instanceof Error)) {
    return { error };
  }

  return {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause: serializeErrorCause(error.cause),
    },
  };
}

export function redactForLogs(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactForLogs(item));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entryValue]) => [
      key,
      SENSITIVE_KEY_PATTERN.test(key) ? "[REDACTED]" : redactForLogs(entryValue),
    ]),
  );
}

function writeLog(
  level: LogLevel,
  scope: string,
  message: string,
  baseContext: LogContext,
  context: LogContext = {},
) {
  const payload = redactForLogs({
    timestamp: new Date().toISOString(),
    level,
    scope,
    message,
    ...baseContext,
    ...context,
  });

  const serializedPayload = JSON.stringify(payload);

  switch (level) {
    case "debug":
      console.debug(serializedPayload);
      break;
    case "info":
      console.info(serializedPayload);
      break;
    case "warn":
      console.warn(serializedPayload);
      break;
    case "error":
      console.error(serializedPayload);
      break;
  }
}

function serializeErrorCause(cause: unknown): unknown {
  if (!cause) {
    return undefined;
  }

  if (cause instanceof Error) {
    return {
      name: cause.name,
      message: cause.message,
      stack: cause.stack,
      cause: serializeErrorCause(cause.cause),
    };
  }

  return cause;
}
