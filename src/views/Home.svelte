<script lang="ts">
  import { ha } from "../lib/store.svelte";
  import { E, INDOOR_LIGHTS, OUTDOOR_LIGHTS, ALL_LIGHTS, ROOMS } from "../lib/entities";
  import { n, power, greeting, tempColor } from "../lib/format";
  import KpiCard from "../lib/components/KpiCard.svelte";
  import RingGauge from "../lib/components/RingGauge.svelte";
  import TankGauge from "../lib/components/TankGauge.svelte";
  import Section from "../lib/components/Section.svelte";
  import Tile from "../lib/components/Tile.svelte";
  import Pill from "../lib/components/Pill.svelte";
  import PowerFlow from "../lib/components/PowerFlow.svelte";

  const now = new Date();
  const dateStr = now.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  // --- Alarm ---
  const armTarget = $derived(
    ha.exists(E.alarmArmTarget)
      ? E.alarmArmTarget
      : ha.exists(E.alarmMain)
        ? E.alarmMain
        : null,
  );
  const alarmState = $derived(ha.state(E.alarmMain) ?? ha.state(armTarget ?? ""));
  const armed = $derived(!!alarmState && alarmState.startsWith("armed"));
  const alarmMeta = $derived.by(() => {
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

  // Two-tap confirm for alarm actions (avoid accidental arm/disarm).
  let confirmArm = $state(false);
  let timer: ReturnType<typeof setTimeout>;
  function tapAlarm() {
    if (!armTarget) return;
    if (!confirmArm) {
      confirmArm = true;
      timer = setTimeout(() => (confirmArm = false), 3000);
      return;
    }
    clearTimeout(timer);
    confirmArm = false;
    if (armed) ha.disarm(armTarget);
    else ha.armAway(armTarget);
  }

  const litCount = $derived(
    ALL_LIGHTS.filter((id) => ha.isOn(id)).length,
  );

  // --- KPI values ---
  const soc = $derived(ha.num(E.batterySoc));
  const battP = $derived(ha.num(E.batteryPower));
  const battFlow = $derived(power(Math.abs(battP ?? 0)));
  const pv = $derived(power(ha.num(E.pvPower)));
  const indep = $derived(ha.num(E.gridIndepToday));
  const tank = $derived(ha.num(E.tankLevel));
  const indoor = $derived(ha.num(E.indoorAvg));
</script>

<!-- Greeting header -->
<header class="hero">
  <div>
    <h1>{greeting(now.getHours())}, Christo</h1>
    <p class="date">{dateStr}</p>
  </div>
  <Pill label={alarmMeta.label} color={alarmMeta.color} />
</header>

<!-- Quick actions -->
<Section title="Quick Actions" hint="{litCount} lights on">
  <div class="qa">
    <Tile
      icon={armed ? "🔓" : "🛡️"}
      name={confirmArm ? "Tap to confirm" : armed ? "Disarm" : "Arm Away"}
      sub={armTarget ? alarmMeta.label : "unavailable"}
      on={armed}
      accent={armed ? "var(--success)" : "var(--warning)"}
      disabled={!armTarget}
      onclick={tapAlarm}
    />
    <Tile
      icon="🌙"
      name="All Lights Off"
      sub="{litCount} on"
      accent="var(--brand)"
      disabled={litCount === 0}
      onclick={() => ha.turnOff(ALL_LIGHTS)}
    />
    <Tile
      icon="💧"
      name="Water Pump"
      sub={ha.isOn(E.waterPump) ? `${n(ha.num("sensor.water_pump_power"))} W` : "Off"}
      on={ha.isOn(E.waterPump)}
      accent="var(--water)"
      onclick={() => ha.toggle(E.waterPump)}
    />
    <Tile
      icon="🏊"
      name="Pool Pump"
      sub={ha.isOn(E.poolPump) ? "Running" : "Off"}
      on={ha.isOn(E.poolPump)}
      accent="var(--water)"
      onclick={() => ha.toggle(E.poolPump)}
    />
    <Tile
      icon="🕳️"
      name="Borehole"
      sub={ha.isOn(E.boreholePump) ? "Running" : "Off"}
      on={ha.isOn(E.boreholePump)}
      accent="var(--water)"
      onclick={() => ha.toggle(E.boreholePump)}
    />
  </div>
</Section>

<!-- Live power flow -->
<Section title="Power Flow">
  <PowerFlow
    pv={ha.num(E.pvPower)}
    battP={ha.num(E.batteryPower)}
    gridP={ha.num(E.gridPower)}
    load={ha.num(E.loads)}
    soc={ha.num(E.batterySoc)}
  />
</Section>

<!-- Hero KPIs -->
<Section title="At a Glance">
  <div class="kpis">
    <KpiCard
      icon="🔋"
      label="Battery"
      value={n(soc)}
      unit="%"
      accent="var(--brand)"
      foots={[
        { v: `${battP != null && battP < 0 ? "−" : "+"}${battFlow.val} ${battFlow.unit}`, l: ha.state(E.batteryState) ?? "" },
        { v: `${n(ha.num(E.batteryVoltage), 1)} V`, l: "Voltage" },
      ]}
    >
      {#snippet right()}
        <RingGauge pct={soc} color="var(--brand)" />
      {/snippet}
    </KpiCard>

    <KpiCard
      icon="☀️"
      label="Solar"
      value={pv.val}
      unit={pv.unit}
      accent="var(--solar)"
      foots={[
        { v: `${n(ha.num(E.pvYieldToday), 1)} kWh`, l: "Today" },
        { v: `${n(ha.num(E.solarYieldWeek), 1)} kWh`, l: "This week" },
      ]}
    />

    <KpiCard
      icon="⚡"
      label="Grid Independence"
      value={n(indep)}
      unit="%"
      accent="var(--success)"
      foots={[
        { v: `${n(ha.num(E.gridImportToday), 1)} kWh`, l: "Imported" },
        { v: `${ha.state(E.gridFreeStreak) ?? "—"}`, l: "Night streak" },
      ]}
    >
      {#snippet right()}
        <RingGauge pct={indep} color="var(--success)" label="today" />
      {/snippet}
    </KpiCard>

    <KpiCard
      icon="🚰"
      label="Water Tank"
      value={n(tank)}
      unit="%"
      accent="var(--water)"
      foots={[
        { v: `${n(ha.num(E.tankDays))} days`, l: "Remaining" },
        { v: `${n(ha.num(E.tankVolume))} L`, l: "Volume" },
      ]}
    >
      {#snippet right()}
        <TankGauge pct={tank} />
      {/snippet}
    </KpiCard>
  </div>
</Section>

<!-- Lights -->
<Section title="Indoor Lights">
  <div class="tiles">
    {#each INDOOR_LIGHTS as l}
      <Tile
        icon={l.icon}
        name={l.label}
        sub={ha.exists(l.id) ? (ha.isOn(l.id) ? "On" : "Off") : "—"}
        on={ha.isOn(l.id)}
        disabled={!ha.exists(l.id)}
        onclick={() => ha.toggle(l.id)}
      />
    {/each}
  </div>
</Section>

<Section title="Outdoor Lights">
  <div class="tiles">
    {#each OUTDOOR_LIGHTS as l}
      <Tile
        icon={l.icon}
        name={l.label}
        sub={ha.exists(l.id) ? (ha.isOn(l.id) ? "On" : "Off") : "—"}
        on={ha.isOn(l.id)}
        disabled={!ha.exists(l.id)}
        onclick={() => ha.toggle(l.id)}
      />
    {/each}
  </div>
</Section>

<!-- Comfort strip -->
<Section title="Comfort" hint="{n(indoor, 1)}°C indoor avg">
  <div class="rooms">
    {#each ROOMS as room}
      {@const t = ha.num(room.id)}
      <div class="room">
        <span class="rt" style="color:{tempColor(t)}">{n(t, 1)}°</span>
        <span class="rl">{room.label}</span>
        {#if room.humidity}
          <span class="rh">{n(ha.num(room.humidity))}% RH</span>
        {/if}
      </div>
    {/each}
  </div>
</Section>

<style>
  .hero {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 26px 2px 4px;
  }
  h1 {
    margin: 0;
    font-size: 32px;
    font-weight: 800;
    letter-spacing: -0.8px;
    background: linear-gradient(120deg, #ffffff 30%, #c4b5fd 75%, #a78bfa 100%);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
  .date {
    margin: 4px 0 0;
    color: var(--text-2);
    font-size: 13.5px;
  }
  .qa {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
    gap: 10px;
  }
  .kpis {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 12px;
  }
  .tiles {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 10px;
  }
  .rooms {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
    gap: 10px;
  }
  .room {
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 15px;
    background: var(--card);
    backdrop-filter: var(--glass-blur);
    -webkit-backdrop-filter: var(--glass-blur);
    border: 1px solid var(--border);
    border-radius: var(--r);
    box-shadow: var(--shadow);
  }
  .rt {
    font-size: 21px;
    font-weight: 700;
  }
  .rl {
    font-size: 12.5px;
    color: var(--text-2);
  }
  .rh {
    font-size: 10.5px;
    color: var(--muted);
  }
</style>
