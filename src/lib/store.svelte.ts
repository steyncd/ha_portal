import {
  connect,
  connectWithToken,
  subscribeEntities,
  callService,
  type Connection,
  type HassEntities,
} from "./ha";
import { HASS_URL } from "./config";
import { loadHaConnection } from "./haConfig";

type Status = "connecting" | "connected" | "error";

/**
 * Race a promise against a timeout. HA's WebSocket `sendMessagePromise` never
 * resolves if a command silently gets no response (flaky link, recorder busy),
 * which would hang any `Promise.all` waiting on it forever. This guarantees a
 * fallback value after `ms` so callers (e.g. Insights) never stall.
 */
function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    let done = false;
    const timer = setTimeout(() => {
      if (!done) {
        done = true;
        resolve(fallback);
      }
    }, ms);
    p.then(
      (v) => {
        if (!done) {
          done = true;
          clearTimeout(timer);
          resolve(v);
        }
      },
      () => {
        if (!done) {
          done = true;
          clearTimeout(timer);
          resolve(fallback);
        }
      },
    );
  });
}

export type Reminder = {
  uid?: string;
  summary: string;
  description?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  rrule?: string | null;
  recurrence_id?: string | null;
};

/**
 * Single reactive source of truth for the live Home Assistant state.
 * Components read `ha.entities` / the helpers and re-render automatically.
 */
class HAStore {
  // $state.raw: the entities map is always REPLACED wholesale (never deep-mutated),
  // so raw state skips deep-proxying ~5000 entities on every WS tick — a big runtime
  // win. Reassignment still triggers reactivity for all readers.
  entities = $state.raw<HassEntities>({});
  status = $state<Status>("connecting");
  error = $state("");
  #conn: Connection | undefined;
  #auth: { accessToken: string; expired: boolean; refreshAccessToken: () => Promise<void> } | undefined;
  #mock = false;
  #pending: HassEntities | null = null;
  #throttle: ReturnType<typeof setTimeout> | null = null;
  // Batches concurrent history() / historyStates() calls sharing the same time
  // window into ONE history_during_period WS request (many entity_ids). A view
  // opening N charts becomes 1 round-trip to HA instead of N (Timeline ~27→1).
  #histBatch = new Map<number, { ids: Set<string>; waiters: { id: string; kind: "num" | "str"; resolve: (v: unknown) => void }[] }>();

  // Coalesce HA state pushes: apply the first immediately (leading edge), then at
  // most once per 300ms, always applying the latest snapshot on the trailing edge.
  // Without this, every WS tick (Victron power pushes ~1/s) reassigns the whole
  // entities map, invalidating every $derived across every view — a recompute +
  // re-layout storm. Dashboards don't need sub-second refresh.
  #applyEntities(ents: HassEntities) {
    if (this.#throttle == null) {
      this.entities = ents;
      this.#throttle = setTimeout(() => {
        this.#throttle = null;
        if (this.#pending) { this.entities = this.#pending; this.#pending = null; }
      }, 300);
    } else {
      this.#pending = ents;
    }
  }

  async init() {
    if (this.status === "connected") return;
    const mock =
      new URLSearchParams(location.search).get("mock") === "1" ||
      import.meta.env.VITE_MOCK === "1";
    if (mock) {
      const { MOCK } = await import("./mock");
      this.entities = MOCK;
      this.#mock = true;
      this.status = "connected";
      return;
    }
    try {
      // Prefer a stored long-lived token (set in Settings); fall back to the
      // interactive HA OAuth flow if none is configured.
      const stored = await loadHaConnection();
      const { auth, connection } = stored
        ? await connectWithToken(stored.url, stored.token)
        : await connect();
      this.#conn = connection;
      this.#auth = auth;
      subscribeEntities(connection, (ents) => this.#applyEntities(ents));
      this.status = "connected";
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e);
      this.status = "error";
    }
  }

  // ---- readers ----
  exists(id: string) {
    return id in this.entities;
  }
  state(id: string): string | undefined {
    return this.entities[id]?.state;
  }
  /** Numeric state, or null when missing / non-numeric / unavailable. */
  num(id: string): number | null {
    const s = this.entities[id]?.state;
    if (s == null || s === "unavailable" || s === "unknown") return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  attr(id: string, name: string): unknown {
    return this.entities[id]?.attributes?.[name];
  }
  name(id: string): string {
    return (this.attr(id, "friendly_name") as string) ?? id;
  }
  isOn(id: string) {
    return this.entities[id]?.state === "on";
  }
  /** True when the entity exists and is reporting a real (non-offline) state. */
  available(id: string) {
    const s = this.entities[id]?.state;
    return s != null && s !== "unavailable" && s !== "unknown";
  }
  unit(id: string): string {
    return (this.attr(id, "unit_of_measurement") as string) ?? "";
  }

  // ---- history ----
  #parseNum(arr: Array<Record<string, unknown>>): { t: number; v: number }[] {
    const out: { t: number; v: number }[] = [];
    for (const p of arr) {
      const v = Number((p.s ?? p.state) as string | number | undefined);
      const lu = p.lu as number | undefined;
      const lc = (p.last_changed ?? p.lc) as string | number | undefined;
      const t = typeof lu === "number" ? lu * 1000 : typeof lc === "number" ? lc * 1000 : lc ? Date.parse(lc) : NaN;
      if (Number.isFinite(v) && Number.isFinite(t)) out.push({ t, v });
    }
    return out;
  }
  #parseStr(arr: Array<Record<string, unknown>>): { t: number; s: string }[] {
    const out: { t: number; s: string }[] = [];
    let prev = "";
    for (const p of arr) {
      const s = String((p.s ?? p.state) ?? "").trim();
      const lu = p.lu as number | undefined;
      const lc = (p.last_changed ?? p.lc) as string | number | undefined;
      const t = typeof lu === "number" ? lu * 1000 : typeof lc === "number" ? lc * 1000 : lc ? Date.parse(lc) : NaN;
      if (!s || s === "None" || s === "unknown" || s === "unavailable" || s === prev || !Number.isFinite(t)) continue;
      prev = s;
      out.push({ t, s });
    }
    return out.reverse();
  }
  // Queue a per-entity history read; concurrent reads over the same window flush
  // together as one WS request on the next microtask.
  #enqueueHist(kind: "num" | "str", entityId: string, hours: number): Promise<unknown> {
    let b = this.#histBatch.get(hours);
    if (!b) {
      b = { ids: new Set(), waiters: [] };
      this.#histBatch.set(hours, b);
      queueMicrotask(() => this.#flushHist(hours));
    }
    b.ids.add(entityId);
    return new Promise((resolve) => b!.waiters.push({ id: entityId, kind, resolve }));
  }
  async #flushHist(hours: number) {
    const b = this.#histBatch.get(hours);
    if (!b) return;
    this.#histBatch.delete(hours);
    let res: Record<string, Array<Record<string, unknown>>> = {};
    if (this.#conn) {
      const end = new Date();
      const start = new Date(end.getTime() - hours * 3_600_000);
      try {
        res = (await withTimeout(
          this.#conn.sendMessagePromise({
            type: "history/history_during_period",
            start_time: start.toISOString(),
            end_time: end.toISOString(),
            entity_ids: [...b.ids],
            minimal_response: true,
            no_attributes: true,
          }),
          20_000,
          {},
        )) as Record<string, Array<Record<string, unknown>>>;
      } catch {
        res = {};
      }
    }
    for (const w of b.waiters) {
      const arr = res?.[w.id] ?? [];
      w.resolve(w.kind === "num" ? this.#parseNum(arr) : this.#parseStr(arr));
    }
  }

  /**
   * Fetch a numeric history series for an entity over the last `hours`.
   * Returns [] on any failure so charts can degrade gracefully.
   * Concurrent calls sharing `hours` are batched into one WS request.
   */
  async history(entityId: string, hours = 24): Promise<{ t: number; v: number }[]> {
    if (this.#mock) return this.#synth(entityId, hours);
    if (!this.#conn) return [];
    return this.#enqueueHist("num", entityId, hours) as Promise<{ t: number; v: number }[]>;
  }

  /**
   * Fetch a string-state history for an entity (e.g. recognised plates),
   * newest first, with consecutive duplicates collapsed.
   */
  async historyStates(
    entityId: string,
    hours = 24,
  ): Promise<{ t: number; s: string }[]> {
    if (this.#mock) {
      const cur = this.state(entityId);
      if (!cur || cur === "None" || cur === "unknown" || cur === "unavailable") return [];
      const now = Date.now();
      if (entityId.includes("plate")) {
        // ~3 weeks of gate recognitions with repeats (some known, some not)
        const seq = ["CA 214-882", "WK 09-JHB", "CA 214-882", "BX 12-CD", "CA 118-540", "CA 214-882", "WK 09-JHB", "DR 55-MN", "CA 214-882", "CA 118-540", "ZN 88-GP", "CA 214-882", "WK 09-JHB", "CA 118-540"];
        return seq.map((s, i) => ({ t: now - i * 34 * 3600_000, s }));
      }
      if (entityId.includes("occupancy")) {
        // gate presence intervals over ~30 days; a few dwell ≥3 min (loitering)
        const durs = [1, 2, 5, 1, 4, 1, 1, 6, 2, 1, 3, 1, 8, 1, 2, 4];
        const out: { t: number; s: string }[] = [];
        let t = now - 30 * 24 * 3600_000;
        for (const d of durs) { out.push({ t, s: "on" }); t += d * 60_000; out.push({ t, s: "off" }); t += 44 * 3600_000; }
        return out.reverse();
      }
      // generic: a few plausible transitions ending at the current state
      const alt = cur === "on" ? "off" : cur === "off" ? "on" : "disarmed";
      return [
        { t: now - 40 * 60_000, s: cur },
        { t: now - 3 * 3600_000, s: alt },
        { t: now - 8 * 3600_000, s: cur },
      ];
    }
    if (!this.#conn) return [];
    return this.#enqueueHist("str", entityId, hours) as Promise<{ t: number; s: string }[]>;
  }

  /**
   * Long-Term Statistics for an entity (kept forever, never purged) via the
   * recorder. Returns one point per `period` with the aggregates HA stores.
   * `mean` for measurement sensors, `change`/`sum` for totals.
   */
  async statistics(
    statisticId: string,
    { period = "day", days = 90, start: startArg, end: endArg }: { period?: "hour" | "day" | "week" | "month"; days?: number; start?: Date | number; end?: Date | number } = {},
  ): Promise<{ t: number; mean: number | null; min: number | null; max: number | null; sum: number | null; change: number | null }[]> {
    if (this.#mock) {
      const span = startArg != null && endArg != null ? Math.max(1, Math.round((+endArg - +startArg) / 86_400_000)) : days;
      return this.#synthStats(statisticId, period, span);
    }
    if (!this.#conn) return [];
    const end = endArg != null ? new Date(+endArg) : new Date();
    const start = startArg != null ? new Date(+startArg) : new Date(end.getTime() - days * 86_400_000);
    const num = (x: unknown) => {
      const n = Number(x);
      return Number.isFinite(n) ? n : null;
    };
    try {
      const res = (await withTimeout(
        this.#conn.sendMessagePromise({
          type: "recorder/statistics_during_period",
          start_time: start.toISOString(),
          end_time: end.toISOString(),
          statistic_ids: [statisticId],
          period,
          types: ["mean", "min", "max", "sum", "change"],
        }),
        20_000,
        {},
      )) as Record<string, Array<Record<string, unknown>>>;
      const arr = res?.[statisticId] ?? [];
      return arr
        .map((p) => {
          const s = p.start as number | string | undefined;
          const t = typeof s === "number" ? s : s ? Date.parse(String(s)) : NaN;
          return { t, mean: num(p.mean), min: num(p.min), max: num(p.max), sum: num(p.sum), change: num(p.change) };
        })
        .filter((p) => Number.isFinite(p.t));
    } catch {
      return [];
    }
  }

  /** Synthetic LTS series with a mild, entity-deterministic trend, for ?mock=1 demos. */
  #synthStats(entityId: string, period: string, days: number) {
    const base = this.num(entityId) ?? 100;
    const now = Date.now();
    const step = period === "hour" ? 3_600_000 : period === "week" ? 7 * 86_400_000 : period === "month" ? 30 * 86_400_000 : 86_400_000;
    const N = Math.max(6, Math.min(120, Math.round((days * 86_400_000) / step)));
    // deterministic slope from the entity id so different metrics trend differently
    let h = 0;
    for (const c of entityId) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
    const slope = ((h % 17) - 8) / 2200; // ≈ -0.36%..+0.32% per step
    const out: { t: number; mean: number; min: number; max: number; sum: number; change: number }[] = [];
    for (let i = 0; i < N; i++) {
      const t = now - (N - 1 - i) * step;
      const wob = Math.sin(i / 2.5) * base * 0.06 + Math.cos(i / 1.3) * base * 0.03;
      const v = Math.max(0, base * (1 + slope * i) + wob);
      out.push({ t, mean: v, min: v * 0.9, max: v * 1.1, sum: v, change: base * slope + wob * 0.2 });
    }
    return out;
  }

  /** Synthetic wobble around the current value, for ?mock=1 demos. */
  #synth(entityId: string, hours: number): { t: number; v: number }[] {
    const base = this.num(entityId) ?? 50;
    const now = Date.now();
    const N = 48;
    const out: { t: number; v: number }[] = [];
    for (let i = 0; i < N; i++) {
      const t = now - ((N - 1 - i) * hours * 3_600_000) / N;
      const wob = Math.sin(i / 3.2) * base * 0.18 + Math.cos(i / 1.7) * base * 0.05;
      out.push({ t, v: Math.max(0, base + wob) });
    }
    return out;
  }

  /**
   * Fetch a real weather forecast via the `weather.get_forecasts` service
   * (returns [] on any failure). `type` is "hourly" or "daily".
   */
  async getForecast(
    entityId: string,
    type: "hourly" | "daily" = "hourly",
  ): Promise<Array<{ datetime: string; temperature: number; condition: string }>> {
    if (this.#mock) {
      const now = Date.now();
      const conds = ["clear-night", "partlycloudy", "cloudy", "partlycloudy", "sunny", "sunny", "partlycloudy"];
      return conds.map((c, i) => ({ datetime: new Date(now + i * 3 * 3600_000).toISOString(), temperature: 16 - i + (i > 3 ? i : 0), condition: c }));
    }
    if (!this.#conn) return [];
    try {
      const res = (await withTimeout(
        this.#conn.sendMessagePromise({
          type: "call_service",
          domain: "weather",
          service: "get_forecasts",
          service_data: { type },
          target: { entity_id: entityId },
          return_response: true,
        }),
        10_000,
        { response: {} },
      )) as { response?: Record<string, { forecast?: Array<{ datetime: string; temperature: number; condition: string }> }> };
      return res?.response?.[entityId]?.forecast ?? [];
    } catch {
      return [];
    }
  }

  // ---- writers ----
  #svc(domain: string, service: string, data: object) {
    if (this.#conn) return callService(this.#conn, domain, service, data);
  }
  #setMock(ids: string | string[], state: string) {
    const list = Array.isArray(ids) ? ids : [ids];
    const next = { ...this.entities };
    for (const id of list) {
      if (next[id]) next[id] = { ...next[id], state };
    }
    this.entities = next;
  }
  toggle(entity_id: string) {
    if (!this.exists(entity_id)) return;
    if (this.#mock) return this.#setMock(entity_id, this.isOn(entity_id) ? "off" : "on");
    return this.#svc("homeassistant", "toggle", { entity_id });
  }
  turnOn(entity_id: string | string[]) {
    if (this.#mock) return this.#setMock(entity_id, "on");
    return this.#svc("homeassistant", "turn_on", { entity_id });
  }
  turnOff(entity_id: string | string[]) {
    if (this.#mock) return this.#setMock(entity_id, "off");
    return this.#svc("homeassistant", "turn_off", { entity_id });
  }
  armAway(entity_id: string) {
    if (this.#mock) return this.#setMock(entity_id, "armed_away");
    return this.#svc("alarm_control_panel", "alarm_arm_away", { entity_id });
  }
  armHome(entity_id: string) {
    if (this.#mock) return this.#setMock(entity_id, "armed_home");
    return this.#svc("alarm_control_panel", "alarm_arm_home", { entity_id });
  }
  armNight(entity_id: string) {
    if (this.#mock) return this.#setMock(entity_id, "armed_night");
    return this.#svc("alarm_control_panel", "alarm_arm_night", { entity_id });
  }
  disarm(entity_id: string) {
    if (this.#mock) return this.#setMock(entity_id, "disarmed");
    return this.#svc("alarm_control_panel", "alarm_disarm", { entity_id });
  }
  /** Press a button entity (e.g. a per-zone bypass / unbypass button). */
  pressButton(entity_id: string) {
    if (this.#mock) return;
    return this.#svc("button", "press", { entity_id });
  }
  /** Optimistically set an entity's state in mock mode only (no-op live). */
  mockSet(entity_id: string, state: string) {
    if (this.#mock) this.#setMock(entity_id, state);
  }

  /** Set a light's brightness (%), rgb colour, or colour temperature (K). */
  lightSet(
    entity_id: string,
    opts: {
      brightness_pct?: number;
      rgb_color?: [number, number, number];
      color_temp_kelvin?: number;
    },
  ) {
    if (this.#mock) {
      // In mock, reflect brightness in state; colour-only changes keep it on.
      const on = opts.brightness_pct == null || opts.brightness_pct > 0;
      this.#setMock(entity_id, on ? "on" : "off");
      return;
    }
    return this.#svc("light", "turn_on", { entity_id, ...opts });
  }
  scene(entity_id: string) {
    if (this.#mock) return;
    return this.#svc("scene", "turn_on", { entity_id });
  }
  script(entity_id: string) {
    if (this.#mock) return;
    const svc = entity_id.replace("script.", "");
    return this.#svc("script", svc, {});
  }
  setBoolean(entity_id: string, on: boolean) {
    if (this.#mock) return this.#setMock(entity_id, on ? "on" : "off");
    return this.#svc("input_boolean", on ? "turn_on" : "turn_off", { entity_id });
  }
  toggleBoolean(entity_id: string) {
    return this.setBoolean(entity_id, !this.isOn(entity_id));
  }
  setNumber(entity_id: string, value: number) {
    if (this.#mock) return this.#setMock(entity_id, String(value));
    return this.#svc("input_number", "set_value", { entity_id, value });
  }
  setSelect(entity_id: string, option: string) {
    if (this.#mock) return this.#setMock(entity_id, option);
    return this.#svc("input_select", "select_option", { entity_id, option });
  }
  setDatetime(entity_id: string, time: string) {
    if (this.#mock) return this.#setMock(entity_id, time);
    return this.#svc("input_datetime", "set_datetime", { entity_id, time });
  }
  /** Broadcast a message to a media/notify target (best-effort). */
  notify(message: string) {
    if (this.#mock) return;
    return this.#svc("notify", "notify", { message });
  }

  // ---- reminders (calendar.reminders) ----
  async #token(): Promise<string> {
    if (this.#auth?.expired) { try { await this.#auth.refreshAccessToken(); } catch { /* use stale */ } }
    return this.#auth?.accessToken ?? "";
  }

  /** Upcoming reminder events over the next `days` (REST — includes uid + rrule). */
  async listReminders(days = 60): Promise<Reminder[]> {
    if (this.#mock) {
      const iso = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();
      return [
        { uid: "m1", summary: "Take out the bins", description: '{"announce":"media_player.study_speaker","wa":["christo"]}', start: { dateTime: iso(14) }, rrule: "FREQ=WEEKLY;BYDAY=TU" },
        { uid: "m2", summary: "Pool service", description: '{"wa":["christo","mandri"]}', start: { dateTime: iso(72) }, rrule: null },
        { uid: "m3", summary: "Give kids their vitamins", description: '{"announce":"media_player.study_speaker","wa":["liam_eben"]}', start: { dateTime: iso(20) }, rrule: "FREQ=DAILY" },
      ];
    }
    const start = new Date().toISOString();
    const end = new Date(Date.now() + days * 86_400_000).toISOString();
    try {
      const res = await fetch(`${HASS_URL}/api/calendars/calendar.reminders?start=${start}&end=${end}`, {
        headers: { Authorization: `Bearer ${await this.#token()}` },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return [];
      return (await res.json()) as Reminder[];
    } catch {
      return [];
    }
  }

  /** Create a reminder event via the calendar CRUD WS command (supports rrule,
   *  unlike the calendar.create_event service). `start`/`end` are naive-local ISO. */
  createReminder(ev: { summary: string; description: string; start: string; end: string; rrule?: string }) {
    if (this.#mock || !this.#conn) return;
    const event: Record<string, unknown> = { summary: ev.summary, description: ev.description, dtstart: ev.start, dtend: ev.end };
    if (ev.rrule) event.rrule = ev.rrule;
    return this.#conn.sendMessagePromise({ type: "calendar/event/create", entity_id: "calendar.reminders", event });
  }

  deleteReminder(uid: string, recurrence_id?: string | null) {
    if (this.#mock || !this.#conn) return;
    const msg = recurrence_id
      ? { type: "calendar/event/delete", entity_id: "calendar.reminders", uid, recurrence_id, recurrence_range: "THISEVENT" }
      : { type: "calendar/event/delete", entity_id: "calendar.reminders", uid };
    return this.#conn.sendMessagePromise(msg);
  }

  /** Fire a reminder right now (announce + push + WhatsApp) — used by "Send test". */
  dispatchReminder(data: { message?: string; template?: string; announce?: string; push?: boolean; wa?: string[] }) {
    if (this.#mock) return;
    // `template` must be sent as `tmpl` — a script variable literally named
    // `template` collides with HA's template-render kwarg and throws.
    const { template, ...rest } = data;
    return this.#svc("script", "dispatch_reminder", { ...rest, tmpl: template ?? "" });
  }

  /** Reassign a logged coffee to me / mandri / guest (only "me" counts). */
  coffeeFlag(index: number, who: "me" | "mandri" | "guest") {
    if (this.#mock) return;
    return this.#svc("script", "coffee_flag_event", { index, who });
  }

  /** Correct a misread plate in the ANPR detection log (by full-log index). */
  anprCorrect(index: number, plate: string) {
    if (this.#mock) return;
    return this.#svc("script", "anpr_correct", { index, plate });
  }

  setText(entity_id: string, value: string) {
    if (this.#mock) return this.#setMock(entity_id, value);
    return this.#svc("input_text", "set_value", { entity_id, value });
  }

  /** Render a Jinja template server-side (one-shot, REST — supports custom
   *  template imports like messages.jinja render()/render_to()). */
  async renderTemplate(template: string): Promise<string> {
    if (this.#mock) return template.replace(/\{%[^%]*%\}/g, "").replace(/\{\{[^}]*\}\}/g, "…").trim() || "…";
    try {
      const res = await fetch(`${HASS_URL}/api/template`, {
        method: "POST",
        headers: { Authorization: `Bearer ${await this.#token()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ template }),
        signal: AbortSignal.timeout(8000),
      });
      return res.ok ? (await res.text()) : "";
    } catch {
      return "";
    }
  }

  // ---- per-destination message templates (message_templates.json store) ----
  /** The full template library { key: { label, base, announce, push_christo, wa_* } }. */
  messageTemplates(): Record<string, Record<string, string>> {
    return (this.attr("sensor.message_templates", "templates") as Record<string, Record<string, string>>) ?? {};
  }

  /** Persist the whole template library (base64 → shell writer) and re-read. */
  async saveMessageTemplates(templates: Record<string, Record<string, string>>) {
    if (this.#mock) return;
    const json = JSON.stringify({ templates });
    const b64 = btoa(unescape(encodeURIComponent(json)));
    await this.#svc("shell_command", "save_message_templates", { data_b64: b64 });
    // bridge: keep any matching legacy input_text.msg_<key> base in sync
    for (const [key, m] of Object.entries(templates)) {
      const legacy = `input_text.msg_${key}`;
      if (this.exists(legacy) && typeof m.base === "string") this.#svc("input_text", "set_value", { entity_id: legacy, value: m.base });
    }
    await this.#svc("homeassistant", "update_entity", { entity_id: "sensor.message_templates" });
  }
}

export const ha = new HAStore();
