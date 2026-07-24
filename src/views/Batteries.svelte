<script lang="ts">
  // Personal-device battery performance & health (Me → Batteries).
  // Level + charging state come straight from HA; "charges / discharge rate /
  // est. runtime / lowest" are DERIVED from 7 days of level history, because
  // Apple doesn't expose battery health or cycle count to HA (only level +
  // state). Oura reports days-of-life directly; Android reports qualitative
  // health. Everything self-guards on availability.
  import { onMount } from "svelte";
  import { ha } from "../lib/store.svelte";
  import Spark from "../lib/components/Spark.svelte";
  import { n } from "../lib/format";

  type Kind = "ios" | "mac" | "oura" | "android";
  type Dev = { key: string; name: string; icon: string; level: string; state?: string; analysis?: string; health?: string; kind: Kind };

  const DEVICES: Dev[] = [
    { key: "phone", name: "iPhone", icon: "📱", level: "sensor.hello_battery_level", state: "sensor.hello_battery_state", kind: "ios" },
    { key: "watch", name: "Apple Watch", icon: "⌚", level: "sensor.hello_watch_battery_level", state: "sensor.hello_watch_battery_state", kind: "ios" },
    { key: "ring", name: "Oura Ring", icon: "💍", level: "sensor.oura_ring_battery_level", analysis: "sensor.oura_battery_analysis", kind: "oura" },
    { key: "mac", name: "MacBook", icon: "💻", level: "sensor.christos_macbook_internal_battery_level", state: "sensor.christos_macbook_internal_battery_state", kind: "mac" },
    { key: "kid", name: "Kid's Phone", icon: "📲", level: "sensor.kid_s_phone_battery_level", state: "sensor.kid_s_phone_battery_state", health: "sensor.kid_s_phone_battery_health", kind: "android" },
  ];

  let hist = $state<Record<string, { t: number; v: number }[]>>({});
  onMount(async () => {
    const entries = await Promise.all(
      DEVICES.map((d) => ha.history(d.level, 24 * 7).then((h) => [d.key, h] as const)),
    );
    hist = Object.fromEntries(entries);
  });

  // Derive charge sessions + discharge rate from a level series.
  function analyse(series: { t: number; v: number }[]) {
    if (!series || series.length < 3) return null;
    let charges = 0, rising = false, drop = 0, hrs = 0, minL = 101, maxL = 0;
    for (let i = 1; i < series.length; i++) {
      const dv = series[i].v - series[i - 1].v;
      const dh = (series[i].t - series[i - 1].t) / 3_600_000;
      minL = Math.min(minL, series[i].v);
      maxL = Math.max(maxL, series[i].v);
      if (dv > 1.5) {
        if (!rising) { charges++; rising = true; }
      } else if (dv < -0.3) {
        rising = false;
        if (dh > 0 && dh < 12) { drop += -dv; hrs += dh; }
      }
    }
    const rate = hrs > 0 ? drop / hrs : null; // %/hour discharging
    return { charges, rate, runtime: rate && rate > 0 ? 100 / rate : null, minL: minL > 100 ? null : minL, maxL };
  }

  const rows = $derived(
    DEVICES.map((d) => {
      const lvl = ha.num(d.level);
      const avail = ha.available(d.level);
      const st = d.state ? ha.state(d.state) : undefined;
      const charging = st ? /charg/i.test(st) && !/not|dis/i.test(st) : false;
      return { d, lvl, avail, st, charging, series: hist[d.key] ?? [], a: analyse(hist[d.key] ?? []) };
    }),
  );

  const colr = (v: number | null) => (v == null ? "var(--muted)" : v <= 15 ? "var(--error)" : v <= 35 ? "var(--warning)" : "var(--success)");
  const fmtH = (h: number | null) => (h == null ? "—" : h < 48 ? `${n(h)}h` : `${n(h / 24, 1)}d`);
  const ago = (h: number | null) => fmtH(h);
</script>

<div class="col">
  <div class="hdr">
    <div>
      <h2>Device batteries</h2>
      <p>Live level &amp; charge state from HA · performance figures derived from 7 days of history.</p>
    </div>
  </div>

  <div class="grid">
    {#each rows as r (r.d.key)}
      <div class="card" class:dim={!r.avail}>
        <div class="top">
          <span class="ic">{r.d.icon}</span>
          <div class="nm">
            <div class="dn">{r.d.name}</div>
            <div class="ds">
              {#if !r.avail}
                {r.d.kind === "mac" ? "Asleep / not reporting" : "Unavailable"}
              {:else if r.charging}
                <span style="color:var(--success)">⚡ Charging</span>
              {:else if r.d.kind === "oura"}
                {ha.available(r.d.analysis!) ? `≈ ${ha.state(r.d.analysis!)} of life` : "On battery"}
              {:else}
                {r.st ?? "On battery"}
              {/if}
            </div>
          </div>
          <div class="pct" style="color:{colr(r.lvl)}">{r.avail ? `${n(r.lvl)}%` : "—"}</div>
        </div>

        <div class="bar"><div class="fill" style="width:{r.avail ? r.lvl ?? 0 : 0}%;background:{colr(r.lvl)}"></div></div>

        {#if r.series.length > 2}
          <div class="spk"><Spark data={r.series} color={colr(r.lvl)} forceMax={100} height={48} /></div>
        {/if}

        <div class="stats">
          <div class="s"><div class="sv">{r.a ? r.a.charges : "—"}</div><div class="sk">charges · 7d</div></div>
          <div class="s"><div class="sv">{r.a?.rate ? `${n(r.a.rate, 1)}%/h` : "—"}</div><div class="sk">avg drain</div></div>
          <div class="s"><div class="sv">{r.a?.runtime ? fmtH(r.a.runtime) : (r.d.kind === "oura" && ha.available(r.d.analysis!) ? ha.state(r.d.analysis!) : "—")}</div><div class="sk">lasts (est.)</div></div>
          <div class="s"><div class="sv">{r.a?.minL != null ? `${n(r.a.minL)}%` : "—"}</div><div class="sk">low · 7d</div></div>
        </div>

        {#if r.d.kind === "android" && ha.available(r.d.health!)}
          <div class="health">Reported health: <b>{ha.state(r.d.health!)}</b></div>
        {:else if r.d.kind === "ios" || r.d.kind === "mac"}
          <div class="health note">Apple doesn't report battery health to HA — figures above are derived from usage.</div>
        {/if}
      </div>
    {/each}
  </div>

  <p class="foot">Low-battery WhatsApp + spoken alerts fire at 20% (set in Home Assistant). Oura also has its own built-in ring reminders.</p>
</div>

<style>
  .col { display: flex; flex-direction: column; gap: 16px; }
  .hdr h2 { font-size: 20px; font-weight: 800; margin: 0; }
  .hdr p { font-size: 12.5px; color: var(--muted); margin: 4px 0 0; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 14px; }
  .card { background: var(--card, rgba(255, 255, 255, 0.04)); border: 1px solid var(--line, rgba(255, 255, 255, 0.08)); border-radius: 18px; padding: 18px; }
  .card.dim { opacity: 0.62; }
  .top { display: flex; align-items: center; gap: 12px; }
  .ic { font-size: 24px; width: 42px; height: 42px; display: grid; place-items: center; border-radius: 12px; background: rgba(255, 255, 255, 0.05); flex: none; }
  .nm { flex: 1; min-width: 0; }
  .dn { font-size: 15px; font-weight: 700; }
  .ds { font-size: 12px; color: var(--muted); margin-top: 2px; }
  .pct { font-size: 24px; font-weight: 800; font-variant-numeric: tabular-nums; }
  .bar { height: 7px; border-radius: 999px; background: rgba(255, 255, 255, 0.08); overflow: hidden; margin: 14px 0 4px; }
  .fill { height: 100%; border-radius: 999px; transition: width 0.5s ease; }
  .spk { margin: 6px 0 10px; }
  .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
  .s { text-align: center; padding: 9px 4px; border-radius: 11px; background: rgba(255, 255, 255, 0.035); }
  .sv { font-size: 14.5px; font-weight: 800; font-variant-numeric: tabular-nums; }
  .sk { font-size: 9.5px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.03em; margin-top: 3px; }
  .health { font-size: 11.5px; color: var(--text-2, var(--muted)); margin-top: 12px; }
  .health.note { color: var(--muted); font-style: italic; }
  .foot { font-size: 11.5px; color: var(--muted); margin: 0; }
</style>
