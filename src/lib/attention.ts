// The "what needs me now" ruleset — the single source of truth for the Needs
// Attention module on the Overview. Each rule reads the live HA store and, when
// something is actionable, yields an item with a severity, a short line, and
// either a one-tap fix (`action`) or a drill-down target (`nav`).
//
// Reading `ha.state/num/isOn` here touches the reactive entities map, so calling
// computeAttention() inside a component's `$derived.by` re-runs on every tick.
import { ha } from "./store.svelte";
import { E, ACCESS } from "./entities";
import { toast } from "./toast.svelte";
import { n } from "./format";

export type AttnSev = "crit" | "warn" | "info";
export type AttnItem = {
  key: string;
  sev: AttnSev;
  icon: string;
  title: string;
  sub?: string;
  nav?: string;
  action?: { label: string; run: () => void };
};

const SEV_RANK: Record<AttnSev, number> = { crit: 0, warn: 1, info: 2 };
const isArmed = (s: string | undefined) => !!s && s.startsWith("armed");

export function computeAttention(): AttnItem[] {
  const items: AttnItem[] = [];
  const add = (i: AttnItem) => items.push(i);

  // ---- CRITICAL ---------------------------------------------------------
  if (ha.state(E.alarmMain) === "triggered")
    add({ key: "alarm-trig", sev: "crit", icon: "🚨", title: "Alarm triggered", sub: "Check cameras & zones", nav: "security" });

  const soc = ha.num(E.batterySoc);
  if (soc != null && soc < 15)
    add({ key: "batt-crit", sev: "crit", icon: "🔋", title: `Battery bank critically low · ${n(soc)}%`, sub: "Shed heavy loads now", nav: "energy" });

  // ---- WARNINGS ---------------------------------------------------------
  // Alarm off while the house is empty — offer a one-tap arm.
  const nobodyHome = ha.isOn(E.nobodyHome) || ha.state(E.occupancy) === "Empty";
  if (nobodyHome && !isArmed(ha.state(E.alarmMain)) && ha.state(E.alarmMain) !== "triggered")
    add({
      key: "alarm-empty", sev: "warn", icon: "🛡️", title: "Alarm is off — house empty",
      action: { label: "Arm away", run: () => { ha.armAway(E.alarmHome); toast.show("Arming away"); } },
    });

  if (ha.state(E.alarmAcPower) === "off")
    add({ key: "alarm-ac", sev: "warn", icon: "🔌", title: "Alarm on backup power", sub: "Mains lost to the alarm panel", nav: "system" });

  // Open external doors — collapse into one line.
  const openDoors = ACCESS
    .filter((d) => /door/i.test(d.label) && ha.isOn(d.id))
    .map((d) => d.label);
  if (openDoors.length)
    add({
      key: "doors-open", sev: "warn", icon: "🚪",
      title: `${openDoors.join(", ")} open`,
      sub: openDoors.length > 1 ? `${openDoors.length} doors` : undefined,
      nav: "security",
    });

  if (soc != null && soc >= 15 && soc < 30)
    add({ key: "batt-low", sev: "warn", icon: "🔋", title: `Battery bank low · ${n(soc)}%`, sub: "Watch heavy appliances", nav: "energy" });

  if (ha.state(E.tankLowAlert) === "on")
    add({
      key: "tank-low", sev: "warn", icon: "💧", title: "Water tank low",
      action: { label: "Start borehole", run: () => { ha.turnOn(E.boreholePump); toast.show("Starting borehole"); } },
    });

  if (ha.state(E.frigateStalled) === "on")
    add({ key: "frigate", sev: "warn", icon: "📷", title: "Camera detection stalled", sub: "Frigate isn't processing", nav: "cameras" });

  // ---- INFO -------------------------------------------------------------
  const lowBatt = ha.num(E.lowBatteryDevices) ?? 0;
  if (lowBatt > 0)
    add({ key: "dev-batt", sev: "info", icon: "🪫", title: `${lowBatt} device${lowBatt === 1 ? "" : "s"} low on battery`, nav: "system" });

  const sysIssues = ha.num(E.systemHealthIssues) ?? 0;
  if (sysIssues > 0)
    add({ key: "sys", sev: "info", icon: "🩺", title: `${sysIssues} system health issue${sysIssues === 1 ? "" : "s"}`, nav: "system" });

  const tankDays = ha.num(E.tankDays);
  if (ha.state(E.tankLowAlert) !== "on" && tankDays != null && tankDays < 2)
    add({ key: "tank-days", sev: "info", icon: "🚰", title: `Water tank ≈ ${n(tankDays, 1)} days left`, nav: "water" });

  return items.sort((a, b) => SEV_RANK[a.sev] - SEV_RANK[b.sev]);
}
