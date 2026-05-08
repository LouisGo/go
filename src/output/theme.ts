import type { Writable } from "node:stream";

type Style = (value: string) => string;

export interface OutputTheme {
  readonly enabled: boolean;
  readonly bold: Style;
  readonly dim: Style;
  readonly accent: Style;
  readonly info: Style;
  readonly success: Style;
  readonly warning: Style;
  readonly danger: Style;
  readonly path: Style;
  readonly command: Style;
}

export function createOutputTheme(
  stream?: Writable,
  env: NodeJS.ProcessEnv = process.env,
): OutputTheme {
  const enabled = shouldUseColor(stream, env);
  const paint = (open: string, close = "\u001B[0m"): Style =>
    enabled ? (value) => `${open}${value}${close}` : (value) => value;

  return {
    enabled,
    bold: paint("\u001B[1m", "\u001B[22m"),
    dim: paint("\u001B[2m", "\u001B[22m"),
    accent: paint("\u001B[35m"),
    info: paint("\u001B[36m"),
    success: paint("\u001B[32m"),
    warning: paint("\u001B[33m"),
    danger: paint("\u001B[31m\u001B[1m", "\u001B[22m\u001B[39m"),
    path: paint("\u001B[36m"),
    command: paint("\u001B[36m\u001B[1m", "\u001B[22m\u001B[39m"),
  };
}

export function headline(theme: OutputTheme, icon: string, title: string, detail?: string): string {
  const text = `${icon} ${theme.bold(title)}`;
  return detail === undefined ? text : `${text}: ${theme.path(detail)}`;
}

export function field(theme: OutputTheme, label: string, value: string): string {
  return `${theme.dim(`${label}:`)} ${value}`;
}

export function tip(theme: OutputTheme, value: string): string {
  return `${theme.info("→")} ${value}`;
}

export function statusToken(theme: OutputTheme, status: string): string {
  const normalized = status.toLowerCase();
  const styled =
    positiveStatuses.has(normalized) || normalized === "fresh"
      ? theme.success(status)
      : cautionStatuses.has(normalized)
        ? theme.warning(status)
        : negativeStatuses.has(normalized) || normalized === "stale"
          ? theme.danger(status)
          : theme.info(status);

  return styled;
}

export function statusIcon(status: string): string {
  const normalized = status.toLowerCase();

  if (positiveStatuses.has(normalized) || normalized === "fresh") {
    return "✓";
  }

  if (negativeStatuses.has(normalized) || normalized === "stale") {
    return "✕";
  }

  if (cautionStatuses.has(normalized)) {
    return "•";
  }

  return "›";
}

export function commandHint(theme: OutputTheme, command: string): string {
  return theme.command(command);
}

function shouldUseColor(stream: Writable | undefined, env: NodeJS.ProcessEnv): boolean {
  if (env.NO_COLOR !== undefined || env.TERM === "dumb") {
    return false;
  }

  if (env.FORCE_COLOR !== undefined && env.FORCE_COLOR !== "0") {
    return true;
  }

  const candidate = stream as (Writable & { readonly isTTY?: boolean }) | undefined;
  return candidate?.isTTY === true;
}

const positiveStatuses = new Set([
  "passed",
  "success",
  "complete",
  "completed",
  "created",
  "updated",
  "enabled",
  "deleted",
  "cleaned",
  "clean",
]);

const cautionStatuses = new Set([
  "skipped",
  "missing",
  "unchanged",
  "absent",
  "planned",
  "available",
]);

const negativeStatuses = new Set([
  "failed",
  "failure",
  "error",
  "blocked",
  "incomplete",
  "invalid",
]);
