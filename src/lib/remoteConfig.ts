// Remote Config. Cloud review §2.1.
//
// The problem it solves: every switch that decides what this app IS lives in the
// client. nav.ts holds RAIL and GUEST_HIDDEN, prefs holds the viewsOn keys in
// localStorage, and the Gemini model names are string literals in
// functions/index.js. Changing any of them is a build and a deploy — including at
// 22:00 when one widget is throwing.
//
// Server-side DEFAULTS, client-side OVERRIDES. That division is the whole point:
// Remote Config decides what a fresh install sees, prefs still decides what
// Christo sees. It turns "nine rail items and 20 spokes, everyone gets the same"
// into "these are on by default, the rest come back with a toggle" — a default
// rather than a deletion argument.
//
// THREE THINGS THAT MAKE THIS SAFE TO ADOPT:
//
// 1. IN-APP DEFAULTS ARE THE SOURCE OF TRUTH UNTIL A PARAMETER EXISTS. Every key
//    below has a real value here, so the app behaves identically before anyone
//    touches the console. Nothing is gated on a parameter being created.
// 2. FETCH FAILURES ARE SILENT AND HARMLESS. Offline, rules-denied, quota — the
//    defaults stand. A config service that can break the app is worse than no
//    config service.
// 3. NOTHING SAFETY-CRITICAL IS REMOTELY CONFIGURABLE. No alarm behaviour, no
//    guard, no threshold that decides whether something is stale. A kill switch
//    can hide a widget; it can never disarm a house.

import { getRemoteConfig, fetchAndActivate, getValue } from "firebase/remote-config";
import { app } from "./firebase";

/** Keys, with the defaults that make the console optional. */
export type ConfigKeys = {
  /** Views on by default for a fresh install. Comma-separated view ids. */
  default_views: string;
  /** Model name for the Functions to use — closes the "2.5 disappeared" trap. */
  gemini_model: string;
  /** Comma-separated feature ids to hide. The 22:00 escape hatch. */
  kill_switches: string;
  /** One line the whole household sees at the top of Home. Empty = nothing shown. */
  notice: string;
};

const DEFAULTS: ConfigKeys = {
  // The nine rail items plus the spokes a member actually opens. Deliberately
  // matches today's behaviour so switching this on changes nothing.
  default_views:
    "home,overview,energy,water,security,climate,household,me,diagnostics,settings",
  // Verified working on this key. gemini-2.5-* returns "no longer available to
  // new users" and the family shuts down in October 2026 — which is exactly the
  // trap this key exists to close without a redeploy.
  gemini_model: "gemini-3.5-flash",
  kill_switches: "",
  notice: "",
};

let values: ConfigKeys = { ...DEFAULTS };
let ready = false;

export function config(): ConfigKeys {
  return values;
}
export function configReady(): boolean {
  return ready;
}

/** Is this feature switched off from the console? */
export function killed(featureId: string): boolean {
  return values.kill_switches
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .includes(featureId);
}

/** Default-on view ids, for a person with no stored prefs yet. */
export function defaultViews(): string[] {
  return values.default_views.split(",").map((s) => s.trim()).filter(Boolean);
}

export async function initRemoteConfig(): Promise<boolean> {
  try {
    const rc = getRemoteConfig(app);
    // 1 hour. Long enough that a phone opened twenty times a day makes one
    // fetch; short enough that a kill switch lands within the hour. The console
    // minimum for a real emergency is to flip the switch and force-reload.
    rc.settings.minimumFetchIntervalMillis = 3_600_000;
    rc.settings.fetchTimeoutMillis = 8_000;
    rc.defaultConfig = { ...DEFAULTS };

    await fetchAndActivate(rc);

    values = {
      default_views: getValue(rc, "default_views").asString() || DEFAULTS.default_views,
      gemini_model: getValue(rc, "gemini_model").asString() || DEFAULTS.gemini_model,
      kill_switches: getValue(rc, "kill_switches").asString(),
      notice: getValue(rc, "notice").asString(),
    };
    ready = true;
    return true;
  } catch {
    // Defaults already in place. Deliberately silent: a failed config fetch is
    // not something the household can act on, and a toast about it would be
    // noise on every flaky connection.
    values = { ...DEFAULTS };
    ready = false;
    return false;
  }
}
