let lastCapturedError: unknown = undefined;

function capture(error: unknown) {
  lastCapturedError = error;
}

if (typeof process !== "undefined" && process?.on) {
  try {
    process.on("uncaughtException", capture);
    process.on("unhandledRejection", capture);
  } catch {
    // no-op in environments without process events
  }
}

export function consumeLastCapturedError(): unknown {
  const err = lastCapturedError;
  lastCapturedError = undefined;
  return err;
}