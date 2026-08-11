// Alarm provenance: who changed the alarm, when, and whether anything explains it.
//
// Extracted from SecurityHub.svelte so the full Security screen can show the same
// line. Two copies of this reasoning would drift, and the one thing it exists to
// catch — protection dropping with no actor — is exactly the thing you cannot
// afford to have working on one screen and not the other.
//
// Fed by input_text.alarm_last_event, written per transition by
// packages/feature_alarm_provenance.yaml. That entity is recorder-backed, so its
// own history IS the audit log.
//
// WHAT HA CAN HONESTLY KNOW: the Olarm integration exposes no acting user, so a
// keypad or Olarm-app change can be PLACED but not ATTRIBUTED. The vocabulary is
// ui / auto / panel / flap, and only `flap` is alarming.
import { ha } from "./store.svelte";
import { E } from "./entities";
import { clock } from "./format";

const PROV = "input_text.alarm_last_event";
const MACHINE = "sensor.ha_last_machine_event";

export type Prov = { f: string; t: string; at: string; a: string; s: string; ar: string };

export type Hero = {
  line: string;
  sub: string;
  /** A limit worth stating on its own muted line, or "" when there is none. */
  limit: string;
  /** True only for the unexplained case. Nothing else earns amber. */
  warn: boolean;
};

function parse(): Prov | null {
  const raw = ha.state(PROV);
  if (!raw || raw === "unknown" || raw === "unavailable") return null;
  try {
    return JSON.parse(raw) as Prov;
  } catch {
    return null;
  }
}

function forWords(ms: number | null): string {
  if (ms == null) return "";
  const mins = Math.max(0, Math.round((Date.now() - ms) / 60_000));
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  return `${h}h ${mins % 60}m`;
}

/**
 * Seconds between the last machine event (reload or restart) and the transition.
 *
 * This is what turns "no actor" from a mystery into a diagnosis: "one second
 * after a config reload" is the sentence that would have explained the
 * 2026-08-09 silent disarm in a glance.
 */
function machineGapSeconds(sinceMs: number | null): number | null {
  const me = ha.state(MACHINE);
  if (!me || me === "unknown" || me === "unavailable" || sinceMs == null) return null;
  const t = Date.parse(me);
  return Number.isFinite(t) ? Math.abs(sinceMs - t) / 1000 : null;
}

export type LogEntry = { t: number; kind: "alarm" | "machine"; text: string; warn: boolean };

/**
 * The audit trail: the provenance entity's own recorder history, interleaved with
 * machine events (reloads and restarts).
 *
 * Interleaved on purpose — a reload one second before an actor-less disarm should
 * be one glance, not two screens. That interleaving is the whole reason the
 * machine-event sensor exists.
 *
 * `hours` defaults to a week; the caller supplies the fetched history because
 * historyStates is async and this module stays synchronous.
 */
export function alarmLog(
  log: { t: number; s: string }[],
  machine: { t: number; s: string }[],
  limit = 40,
): LogEntry[] {
  const out: LogEntry[] = [];
  for (const e of log) {
    try {
      const p = JSON.parse(String(e.s)) as Prov;
      const who =
        p.s === "flap" ? "a reload"
        : p.s === "ui" ? p.a || "portal"
        : p.s === "auto" ? "automation"
        : "the panel";
      out.push({
        t: e.t,
        kind: "alarm",
        text: `${p.ar === "beams" ? "Beams" : "House"} ${p.f} → ${p.t} · ${who}`,
        warn: p.t === "disarmed" && p.f.startsWith("armed") && (p.s === "flap" || !p.a),
      });
    } catch {
      // A non-JSON value is the helper having been reset; skip rather than throw.
    }
  }
  for (const e of machine) {
    out.push({
      t: e.t,
      kind: "machine",
      text: `Home Assistant ${String(e.s).includes("start") ? "restarted" : "reloaded"}`,
      warn: false,
    });
  }
  return out.sort((a, b) => b.t - a.t).slice(0, limit);
}

/** Entity ids the caller needs to fetch history for, to feed alarmLog(). */
export const PROV_ENTITIES = { prov: PROV, machine: MACHINE };

/** The one-line status, with since-when and who. Never a bare present tense. */
export function alarmHero(): Hero {
  const prov = parse();
  const homeState = ha.state(E.alarmHome) ?? "unknown";
  const armed = homeState.startsWith("armed");

  if (!prov) {
    return {
      line: armed ? "Armed" : "Disarmed",
      sub: "No provenance recorded yet — the first transition after the restart will fill this in.",
      limit: "",
      warn: false,
    };
  }

  const at = Date.parse(prov.at);
  const sinceMs = Number.isFinite(at) ? at : null;
  const since = sinceMs ? clock(sinceMs) : "?";

  // NAME THE PLACE, THEN THE LIMIT — and `panel` must look NORMAL. It is normal
  // life: Christo at the keypad or Mandri in the Olarm app. If `panel` carried
  // any amber, within a week nobody would read this line at all, and `flap` —
  // the one state that matters — would be lost in the noise.
  const actorWords =
    prov.s === "flap" ? "with no actor"
    : prov.s === "ui" ? `by ${prov.a || "someone"}`
    : prov.s === "auto" ? (prov.a && prov.a !== "automation" ? `by ${prov.a}` : "by schedule")
    : prov.s === "panel" ? "at the panel"
    : "unattributed";

  const actorLimit =
    prov.s === "panel" ? "keypad, remote or the Olarm app · not attributable to a person" : "";

  // Protection dropped and nothing a person did explains it. This is the state
  // the Security screen existed to catch and could not.
  const unexplained =
    prov.t === "disarmed" && prov.f.startsWith("armed") && (prov.s === "flap" || !prov.a);

  if (unexplained) {
    const gap = machineGapSeconds(sinceMs);
    return {
      line: "State changed with no actor",
      sub:
        gap != null && gap < 120
          ? `${since}, ${Math.round(gap)} seconds after a config reload`
          : `${since} · nothing a person did explains this`,
      limit: "",
      warn: true,
    };
  }

  return {
    line: armed ? `Continuously armed for ${forWords(sinceMs)}` : `Disarmed for ${forWords(sinceMs)}`,
    sub: `since ${since} · ${prov.t === "disarmed" ? "disarmed" : "armed"} ${actorWords}`,
    limit: actorLimit,
    warn: false,
  };
}
