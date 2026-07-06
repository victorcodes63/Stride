export type SlowQueryEvent = {
  route: string;
  durationMs: number;
  query: string;
  params: string;
};

type SlowQueryCollector = (event: SlowQueryEvent) => void;

let collector: SlowQueryCollector | null = null;
let currentRoute = 'unknown';

export function registerSlowQueryCollector(fn: SlowQueryCollector): void {
  collector = fn;
}

export function notifySlowQuery(event: SlowQueryEvent): void {
  collector?.(event);
}

export function setQueryTimingRoute(route: string): void {
  currentRoute = route;
}

export function getQueryTimingRoute(): string {
  return currentRoute;
}
