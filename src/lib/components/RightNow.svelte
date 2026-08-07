<script lang="ts">
  // Context band (Overview) — a slim strip that surfaces the RIGHT guidance for
  // the moment: it changes with time of day and presence, shows 2–3 relevant
  // facts, and offers the one action that fits (morning scene, goodnight, arm…).
  // Everything self-guards on availability; chips that have no data drop out.
  import { ha } from "../store.svelte";
  import { E, ALL_LIGHTS } from "../entities";
  import { toast } from "../toast.svelte";
  import { n, sastHour } from "../format";

  type Chip = { icon: string; label: string };
  type Ctx = { key: string; icon: string; title: string; chips: Chip[]; action?: { label: string; run: () => void } };

  const WX: Record<string, string> = { sunny: "☀️", "clear-night": "🌙", clear: "🌙", partlycloudy: "⛅", cloudy: "☁️", rainy: "🌧️", pouring: "⛈️", lightning: "⚡", "lightning-rainy": "⛈️", fog: "🌫️", windy: "💨", hail: "🌨️" };

  const armed = $derived((ha.state(E.alarmMain) ?? "").startsWith("armed"));
  const litCount = $derived(ALL_LIGHTS.filter((id) => ha.isOn(id)).length);

  // Build only chips whose data is present.
  function chip(cond: unknown, icon: string, label: string): Chip | null {
    return cond != null && cond !== "" ? { icon, label } : null;
  }

  const loadshedding = $derived(ha.isOn(E.loadsheddingActive));

  const ctx = $derived.by((): Ctx => {
    const h = sastHour();
    const away = ha.isOn(E.nobodyHome) || ha.state(E.occupancy) === "Empty";
    const soc = ha.num(E.batterySoc);
    const wx = WX[ha.state(E.weather) ?? ""] ?? "🌡️";
    const outdoor = ha.num("sensor.outdoor_temperature");
    const readiness = ha.num(E.ouraReadiness);
    const indoor = ha.num(E.indoorAvg);
    const tankDays = ha.num(E.tankDays);
    const gate = ha.num(E.gateDetections);
    const indep = ha.num(E.gridIndepToday);
    const pv = ha.num(E.pvPower);

    const keep = (arr: (Chip | null)[]) => arr.filter((c): c is Chip => !!c).slice(0, 3);

    if (away) {
      return {
        key: "away", icon: "🚪", title: "Away",
        chips: keep([
          { icon: "🛡️", label: armed ? "Alarm armed" : "Alarm off" },
          chip(gate, "🚗", `${n(gate)} at gate today`),
          litCount ? { icon: "💡", label: `${litCount} light${litCount === 1 ? "" : "s"} on` } : null,
        ]),
        action: armed ? undefined : { label: "Arm away", run: () => { ha.armAway(E.alarmHome); toast.show("Arming away"); } },
      };
    }
    if (h >= 5 && h < 11) {
      return {
        key: "morning", icon: "☀️", title: "Morning",
        chips: keep([
          chip(readiness, "💍", `Readiness ${n(readiness)}`),
          outdoor != null ? { icon: wx, label: `${n(outdoor)}° out` } : null,
          chip(soc, "🔋", `${n(soc)}% battery`),
        ]),
        action: { label: "Morning scene", run: () => { ha.script(E.scMorning); toast.show("Good morning"); } },
      };
    }
    if (h >= 11 && h < 17) {
      return {
        key: "day", icon: "🌤️", title: "Midday",
        chips: keep([
          chip(indep, "⚡", `${n(indep)}% independent`),
          pv != null ? { icon: "☀️", label: `${n(pv)} W solar` } : null,
          chip(soc, "🔋", `${n(soc)}% battery`),
        ]),
        action: ha.isOn(E.solarSurplusWindow) ? { label: "Run pool pump", run: () => { ha.turnOn(E.poolPump); toast.show("Pool pump on — using surplus"); } } : undefined,
      };
    }
    if (h >= 17 && h < 21) {
      return {
        key: "evening", icon: "🌆", title: "Evening",
        chips: keep([
          litCount ? { icon: "💡", label: `${litCount} light${litCount === 1 ? "" : "s"} on` } : null,
          { icon: "🛡️", label: armed ? "Alarm armed" : "Alarm off" },
          indoor != null ? { icon: "🌡️", label: `${n(indoor, 1)}° inside` } : null,
        ]),
        action: { label: "Movie mode", run: () => { ha.script(E.scMovie); toast.show("Movie mode"); } },
      };
    }
    // night
    return {
      key: "night", icon: "🌙", title: "Night",
      chips: keep([
        { icon: "🛡️", label: armed ? "Alarm armed" : "Alarm off" },
        chip(soc, "🔋", `${n(soc)}% reserve`),
        chip(tankDays, "💧", `${n(tankDays, 1)}d water`),
      ]),
      action: { label: "Goodnight", run: () => { ha.script(E.scGoodnight); toast.show("Goodnight"); } },
    };
  });
</script>

<div class="rn" data-period={ctx.key} class:ls={loadshedding}>
  <span class="pic">{ctx.icon}</span>
  <span class="ttl">{ctx.title}</span>
  <div class="chips">
    {#if loadshedding}<span class="chip alarm"><span class="ci">⚡</span>Loadshedding</span>{/if}
    {#each ctx.chips as c (c.label)}
      <span class="chip"><span class="ci">{c.icon}</span>{c.label}</span>
    {/each}
  </div>
  {#if ctx.action}
    <button class="act" onclick={ctx.action.run}>{ctx.action.label}</button>
  {/if}
</div>

<style>
  .rn { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; padding: 12px 16px; border-radius: var(--r-card, 18px); background: linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.025)); box-shadow: inset 0 1px 0 rgba(255,255,255,0.1), 0 18px 40px -28px #000; }
  .pic { font-size: 20px; flex: none; }
  .ttl { font-size: 13.5px; font-weight: 700; color: var(--text); flex: none; }
  .chips { display: flex; flex-wrap: wrap; gap: 7px; flex: 1; min-width: 0; }
  .chip { display: inline-flex; align-items: center; gap: 5px; font-size: 11.5px; font-weight: 600; color: var(--text-2); background: rgba(255,255,255,0.05); border-radius: 999px; padding: 5px 11px; white-space: nowrap; }
  .chip.alarm { color: var(--error); background: color-mix(in srgb, var(--error) 14%, transparent); }
  .rn.ls { box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--error) 30%, transparent); }
  .ci { font-size: 12px; }
  .act { flex: none; font-size: 12px; font-weight: 700; color: #05070c; background: var(--grad, var(--acc)); border-radius: 10px; padding: 8px 14px; }
  .act:hover { filter: brightness(1.06); }
  @media (max-width: 560px) {
    .rn { flex-wrap: wrap; }
    .chips { order: 3; flex-basis: 100%; }
  }
</style>
