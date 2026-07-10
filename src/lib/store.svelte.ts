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

  async init() {
    if (this.status === "connected") return;
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
  unit(id: string): string {
    return (this.attr(id, "unit_of_measurement") as string) ?? "";
  }

  // ---- writers ----
  #svc(domain: string, service: string, data: object) {
    if (this.#conn) return callService(this.#conn, domain, service, data);
  }
  toggle(entity_id: string) {
    if (!this.exists(entity_id)) return;
    return this.#svc("homeassistant", "toggle", { entity_id });
  }
  turnOn(entity_id: string | string[]) {
    return this.#svc("homeassistant", "turn_on", { entity_id });
  }
  turnOff(entity_id: string | string[]) {
    return this.#svc("homeassistant", "turn_off", { entity_id });
  }
  armAway(entity_id: string) {
    return this.#svc("alarm_control_panel", "alarm_arm_away", { entity_id });
  }
  armHome(entity_id: string) {
    return this.#svc("alarm_control_panel", "alarm_arm_home", { entity_id });
  }
  disarm(entity_id: string) {
    return this.#svc("alarm_control_panel", "alarm_disarm", { entity_id });
  }
}

export const ha = new HAStore();
