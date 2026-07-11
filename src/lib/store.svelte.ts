import {
  connect,
  subscribeEntities,
  callService,
  type Connection,
  type HassEntities,
} from "./ha";

type Status = "connecting" | "connected" | "error";

/**
 * Single reactive source of truth for the live Home Assistant state.
 * Components read `ha.entities` / the helpers and re-render automatically.
 */
class HAStore {
  entities = $state<HassEntities>({});
  status = $state<Status>("connecting");
  error = $state("");
  #conn: Connection | undefined;
  #mock = false;

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
      const { connection } = await connect();
      this.#conn = connection;
      subscribeEntities(connection, (ents) => {
        this.entities = ents;
      });
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
  /**
   * Fetch a numeric history series for an entity over the last `hours`.
   * Returns [] on any failure so charts can degrade gracefully.
   */
  async history(
    entityId: string,
    hours = 24,
  ): Promise<{ t: number; v: number }[]> {
    if (this.#mock) return this.#synth(entityId, hours);
    if (!this.#conn) return [];
    const end = new Date();
    const start = new Date(end.getTime() - hours * 3_600_000);
    try {
      const res = (await this.#conn.sendMessagePromise({
        type: "history/history_during_period",
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        entity_ids: [entityId],
        minimal_response: true,
        no_attributes: true,
      })) as Record<string, Array<Record<string, unknown>>>;
      const arr = res?.[entityId] ?? [];
      const out: { t: number; v: number }[] = [];
      for (const p of arr) {
        const raw = (p.s ?? p.state) as string | number | undefined;
        const v = Number(raw);
        const lu = p.lu as number | undefined;
        const lc = (p.last_changed ?? p.lc) as string | number | undefined;
        const t =
          typeof lu === "number"
            ? lu * 1000
            : typeof lc === "number"
              ? lc * 1000
              : lc
                ? Date.parse(lc)
                : NaN;
        if (Number.isFinite(v) && Number.isFinite(t)) out.push({ t, v });
      }
      return out;
    } catch {
      return [];
    }
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
}

export const ha = new HAStore();
