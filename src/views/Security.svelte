<script lang="ts">
  import { ha } from "../lib/store.svelte";
  import { E, ZONES } from "../lib/entities";
  import Section from "../lib/components/Section.svelte";
  import Tile from "../lib/components/Tile.svelte";
  import Pill from "../lib/components/Pill.svelte";

  const armTarget = $derived(
    ha.exists(E.alarmArmTarget) ? E.alarmArmTarget : ha.exists(E.alarmMain) ? E.alarmMain : null,
  );
  const alarmState = $derived(ha.state(E.alarmMain) ?? ha.state(armTarget ?? ""));
  const armed = $derived(!!alarmState && alarmState.startsWith("armed"));
  const meta = $derived.by(() => {
    switch (alarmState) {
      case "armed_away": return { label: "Armed · Away", color: "var(--success)" };
      case "armed_home":
      case "armed_night": return { label: "Armed · Home", color: "var(--success)" };
      case "triggered": return { label: "ALARM TRIGGERED", color: "var(--error)" };
      case "arming":
      case "pending": return { label: "Arming…", color: "var(--warning)" };
      case "disarmed": return { label: "Disarmed", color: "var(--warning)" };
      default: return { label: "Unknown", color: "var(--muted)" };
    }
  });

  const openZones = $derived(ZONES.filter((z) => ha.state(z.id) === "on"));
  const acPower = $derived(ha.state(E.alarmAcPower) === "on");
  const bypassed = $derived(ha.num(E.bypassedZones));

  // Two-tap confirm.
  let confirm = $state<"arm" | "disarm" | null>(null);
  let timer: ReturnType<typeof setTimeout>;
  function tap(action: "arm" | "disarm") {
    if (!armTarget) return;
    if (confirm !== action) {
      confirm = action;
      clearTimeout(timer);
      timer = setTimeout(() => (confirm = null), 3000);
      return;
    }
    clearTimeout(timer);
    confirm = null;
    if (action === "arm") ha.armAway(armTarget);
    else ha.disarm(armTarget);
  }
</script>

<div class="status card" style="--c:{meta.color}">
  <div class="ring">{armed ? "🛡️" : "🔓"}</div>
  <div class="info">
    <div class="t-label">System Status</div>
    <div class="big" style="color:{meta.color}">{meta.label}</div>
    <div class="chips">
      <Pill label={acPower ? "AC Power OK" : "AC Power Lost"} color={acPower ? "var(--success)" : "var(--error)"} />
      <Pill label="{bypassed ?? 0} bypassed" color="var(--muted)" />
      <Pill label="{openZones.length} zones active" color={openZones.length ? "var(--warning)" : "var(--success)"} />
    </div>
  </div>
</div>

<div class="actions">
  <Tile
    icon="🛡️"
    name={confirm === "arm" ? "Tap to confirm" : "Arm Away"}
    sub={armTarget ? "arm the alarm" : "unavailable"}
    on={armed}
    accent="var(--success)"
    disabled={!armTarget || armed}
    onclick={() => tap("arm")}
  />
  <Tile
    icon="🔓"
    name={confirm === "disarm" ? "Tap to confirm" : "Disarm"}
    sub={armTarget ? "disarm the alarm" : "unavailable"}
    accent="var(--error)"
    disabled={!armTarget || !armed}
    onclick={() => tap("disarm")}
  />
</div>

<Section title="Zones" hint={openZones.length ? `${openZones.length} active` : "all clear"}>
  <div class="zones">
    {#each ZONES as z}
      {@const active = ha.state(z.id) === "on"}
      <div class="zone" class:active>
        <span class="zdot" class:active></span>
        <span class="zlabel">{z.label}</span>
        <span class="zstate">{active ? "Active" : "Clear"}</span>
      </div>
    {/each}
  </div>
</Section>

<style>
  .status {
    display: flex;
    align-items: center;
    gap: 20px;
    padding: 24px;
    margin-top: 20px;
  }
  .ring {
    width: 68px;
    height: 68px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    font-size: 30px;
    background: color-mix(in srgb, var(--c) 14%, transparent);
    border: 2px solid color-mix(in srgb, var(--c) 45%, transparent);
    flex-shrink: 0;
  }
  .big {
    font-size: 32px;
    font-weight: 700;
    letter-spacing: -0.5px;
    margin: 4px 0 12px;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-top: 12px;
  }
  .zones {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 10px;
  }
  .zone {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 16px;
    background: var(--card);
    backdrop-filter: var(--glass-blur);
    -webkit-backdrop-filter: var(--glass-blur);
    border: 1px solid var(--border);
    border-radius: var(--r);
    box-shadow: var(--shadow);
  }
  .zone.active {
    border-color: color-mix(in srgb, var(--warning) 50%, transparent);
    background: color-mix(in srgb, var(--warning) 8%, transparent);
  }
  .zdot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--success);
    flex-shrink: 0;
  }
  .zdot.active {
    background: var(--warning);
    box-shadow: 0 0 8px var(--warning);
  }
  .zlabel {
    font-size: 13px;
    font-weight: 600;
    flex: 1;
  }
  .zstate {
    font-size: 11px;
    color: var(--muted);
  }
</style>
