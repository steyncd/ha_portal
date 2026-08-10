// Performance Monitoring. Cloud review §2.2.
//
// This exists to settle an argument the project has been having with itself. The
// backdrop-filter audit concluded that the sticky sidebar, header, mobile nav and
// sheets recomposite on every scroll frame — and that was a HYPOTHESIS WITH NO
// MEASUREMENT BEHIND IT. I acted on it in Phase 1 (removed backdrop-filter from
// persistent chrome, kept it behind modals) on reasoning alone. Traces turn the
// performance budget into numbers from a real phone on real ZA mobile data.
//
// Two custom traces, because they are the two things that actually make this app
// feel slow and neither is visible in a Lighthouse run:
//
//   ha_first_state  — sign-in to the first full entity snapshot over WSS. This is
//                     the real "app is usable" moment; everything before it is a
//                     skeleton.
//   ha_history      — a history fetch. The store batches concurrent reads into one
//                     request, so this measures the batch, which is the thing
//                     worth knowing about.
//
// Free, web-supported, no sampling decisions to make at household volume. And it
// is import-and-go: nothing else in the app changes.

import { getPerformance, trace as fbTrace, type FirebasePerformance } from "firebase/performance";
import { app } from "./firebase";

let perf: FirebasePerformance | null = null;

export function initPerf(): boolean {
  try {
    // Never in mock or dev: local numbers are meaningless and would pollute the
    // real distribution with a laptop on fibre.
    if (import.meta.env.DEV) return false;
    if (new URLSearchParams(location.search).get("mock") === "1") return false;
    perf = getPerformance(app);
    return true;
  } catch {
    return false;
  }
}

/**
 * Start a named trace. Returns a stop function that is always safe to call —
 * including when Performance Monitoring never initialised, which keeps every call
 * site free of null checks.
 */
export function startTrace(name: string, attrs?: Record<string, string>): () => void {
  if (!perf) return () => {};
  try {
    const t = fbTrace(perf, name);
    if (attrs) for (const [k, v] of Object.entries(attrs)) t.putAttribute(k, v.slice(0, 100));
    t.start();
    let stopped = false;
    return () => {
      if (stopped) return;
      stopped = true;
      try { t.stop(); } catch { /* a double stop must never throw into a caller */ }
    };
  } catch {
    return () => {};
  }
}

/** Convenience for an async block. Stops the trace even if the promise rejects. */
export async function traced<T>(name: string, fn: () => Promise<T>, attrs?: Record<string, string>): Promise<T> {
  const stop = startTrace(name, attrs);
  try {
    return await fn();
  } finally {
    stop();
  }
}
