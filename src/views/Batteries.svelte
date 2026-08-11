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

  type Kind = "ios" | "mac" | "oura" | "android" | "airpods";
  type Sub = { label: string; id: string };
  type Dev = { key: string; name: string; icon: string; level: string; state?: string; analysis?: string; health?: string; kind: Kind; subs?: Sub[] };

  const DEVICES: Dev[] = [
    { key: "phone", name: "iPhone", icon: "📱", level: "sensor.hello_battery_level", state: "sensor.hello_battery_state", kind: "ios" },
    { key: "ipad", name: "iPad", icon: "📲", level: "sensor.ipad_battery_level", state: "sensor.ipad_battery_state", kind: "ios" },
    { key: "watch", name: "Apple Watch", icon: "⌚", level: "sensor.hello_watch_battery_level", state: "sensor.hello_watch_battery_state", kind: "ios" },
    // AirPods aren't exposed to HA — case/L/R are input_number helpers kept fresh
    // by an iOS Shortcut (webhook: airpods_battery_sync). Headline % = lowest of the three.
    { key: "airpods", name: "AirPods Pro", icon: "🎧", level: "input_number.airpods_left_battery", kind: "airpods",
      subs: [
        { label: "Case", id: "input_number.airpods_case_battery" },
        { label: "Left", id: "input_number.airpods_left_battery" },
        { label: "Right", id: "input_number.airpods_right_battery" },
      ] },
    { key: "ring", name: "Oura Ring", icon: "💍", level: "sensor.oura_ring_battery_level", analysis: "sensor.oura_battery_analysis", kind: "oura" },
    { key: "mac", name: "MacBook", icon: "💻", level: "sensor.christos_macbook_internal_battery_level", state: "sensor.christos_macbook_internal_battery_state", kind: "mac" },
    { key: "kid", name: "Kid's Phone", icon: "📲", level: "sensor.kid_s_phone_battery_level", state: "sensor.kid_s_phone_battery_state", health: "sensor.kid_s_phone_battery_health", kind: "android" },
  ];

  let hist = $state<Record<string, { t: number; v: number }[]>>({});
  let loadError = $state(false);
  onMount(async () => {
    try {
      const entries = await Promise.all(
        DEVICES.map((d) => ha.history(d.level, 24 * 7).then((h) => [d.key, h] as const)),
      );
      hist = Object.fromEntries(entries);
    } catch { loadError = true; }
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
      // AirPods: headline % is the lowest of case / L / R; per-sub bars rendered below.
      const subs = d.subs?.map((s) => ({ ...s, v: ha.num(s.id), avail: ha.available(s.id) })) ?? [];
      const subAvail = subs.filter((s) => s.avail && s.v != null);
      const lvl = d.kind === "airpods"
        ? (subAvail.length ? Math.min(...subAvail.map((s) => s.v as number)) : null)
        : ha.num(d.level);
      const avail = d.kind === "airpods" ? subAvail.length > 0 : ha.available(d.level);
      const st = d.state ? ha.state(d.state) : undefined;
      const charging = st ? /charg/i.test(st) && !/not|dis/i.test(st) : false;
      // Freshness: iOS pushes battery sporadically — flag when it hasn't reported in a while.
      const lu = ha.entities[d.level]?.last_updated;
      const staleH = lu ? (Date.now() - Date.parse(lu)) / 3_600_000 : null;
      const stale = avail && staleH != null && staleH > 1;
      return { d, lvl, avail, st, charging, staleH, stale, subs, series: hist[d.key] ?? [], a: d.kind === "airpods" ? null : analyse(hist[d.key] ?? []) };
    }),
  );

  const colr = (v: number | null) => (v == null ? "var(--muted)" : v <= 15 ? "var(--error)" : v <= 35 ? "var(--warning)" : "var(--success)");
  const fmtH = (h: number | null) => (h == null ? "—" : h < 48 ? `${n(h)}h` : `${n(h / 24, 1)}d`);
  const ago = (h: number | null) => fmtH(h);
</script>

<div class="col">
  {#if loadError}<div style="padding:10px 14px;border-radius:12px;background:rgba(230,159,0,.12);border:1px solid rgba(230,159,0,.35);font-size:12.5px;color:var(--text)">⚠ Couldn't load battery history — check the Home Assistant connection.</div>{/if}
  <div class="hdr">
    <div>
      <h2>Device batteries</h2>
      <p>Live level &amp; charge state from HA · performance figures derived from 7 days of history.</p>
    </div>
  </div>

  <div class="grid">
    {#each rows as r (r.d.key)}
      <div class="card" class:dim={!r.avail} class:stale={r.stale}>
        <div class="top">
          <span class="ic">{r.d.icon}</span>
          <div class="nm">
            <div class="dn">{r.d.name}</div>
            <div class="ds">
              {#if !r.avail}
                {r.d.kind === "mac" ? "Asleep / not reporting" : r.d.kind === "airpods" ? "Not synced yet" : "Unavailable"}
              {:else if r.d.kind === "airpods"}
                Synced from Mac / Shortcut
              {:else if r.charging}
                <span style="color:var(--success)">⚡ Charging</span>
              {:else if r.d.kind === "oura"}
                {ha.available(r.d.analysis!) ? `≈ ${ha.state(r.d.analysis!)} of life` : "On battery"}
              {:else}
                {r.st ?? "On battery"}
              {/if}
              {#if r.stale}<span class="stalepill">· updated {fmtH(r.staleH)} ago</span>{/if}
            </div>
          </div>
          <div class="pct" style="color:{colr(r.lvl)}">{r.avail ? `${n(r.lvl)}%` : "—"}</div>
        </div>

        <div class="bar"><div class="fill" style="width:{r.avail ? r.lvl ?? 0 : 0}%;background:{colr(r.lvl)}"></div></div>

        {#if r.d.kind === "airpods"}
          <div class="subs">
            {#each r.subs as s (s.id)}
              <div class="sub">
                <div class="subhd"><span class="subl">{s.label}</span><span class="subv" style="color:{colr(s.v)}">{s.avail && s.v != null ? `${n(s.v)}%` : "—"}</span></div>
                <div class="bar sm"><div class="fill" style="width:{s.avail && s.v != null ? s.v : 0}%;background:{colr(s.v)}"></div></div>
              </div>
            {/each}
          </div>
          <div class="health note">Not exposed to HA — kept fresh by an iOS Shortcut (AirPods-connect trigger → webhook).</div>
        {:else}
        {#if r.series.length > 2}
          <div class="spk"><Spark data={r.series} color={colr(r.lvl)} forceMax={100} height={48} /></div>
        {/if}

        <div class="stats">
          <div class="s"><div class="sv">{r.a ? r.a.charges : "—"}</div><div class="sk">Charges · 7d</div></div>
          <div class="s"><div class="sv">{r.a?.rate ? `${n(r.a.rate, 1)}%/h` : "—"}</div><div class="sk">Avg drain</div></div>
          <div class="s"><div class="sv">{r.a?.runtime ? fmtH(r.a.runtime) : (r.d.kind === "oura" && ha.available(r.d.analysis!) ? ha.state(r.d.analysis!) : "—")}</div><div class="sk">Lasts (est.)</div></div>
          <div class="s"><div class="sv">{r.a?.minL != null ? `${n(r.a.minL)}%` : "—"}</div><div class="sk">Low · 7d</div></div>
        </div>

        {#if r.d.kind === "android" && ha.available(r.d.health!)}
          <div class="health">Reported health: <b>{ha.state(r.d.health!)}</b></div>
        {:else if r.d.kind === "ios" || r.d.kind === "mac"}
          <div class="health note">Apple doesn't report battery health to HA — figures above are derived from usage.</div>
        {/if}
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
  .card.stale { opacity: 0.7; box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--warning) 30%, transparent); }
  .stalepill { color: var(--warning); }
  .top { display: flex; align-items: center; gap: 12px; }
  .ic { font-size: 24px; width: 42px; height: 42px; display: grid; place-items: center; border-radius: 12px; background: rgba(255, 255, 255, 0.05); flex: none; }
  .nm { flex: 1; min-width: 0; }
  .dn { font-size: 15px; font-weight: 700; }
  .ds { font-size: 12px; color: var(--muted); margin-top: 2px; }
  .pct { font-size: 24px; font-weight: 800; font-variant-numeric: tabular-nums; }
  .bar { height: 7px; border-radius: 999px; background: rgba(255, 255, 255, 0.08); overflow: hidden; margin: 14px 0 4px; }
  .fill { height: 100%; border-radius: 999px; transition: width 0.5s ease; }
  .spk { margin: 6px 0 10px; }
  .subs { display: flex; flex-direction: column; gap: 9px; margin: 12px 0 4px; }
  .subhd { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px; }
  .subl { font-size: 12px; color: var(--muted); }
  .subv { font-size: 13.5px; font-weight: 800; font-variant-numeric: tabular-nums; }
  .bar.sm { height: 6px; margin: 0; }
  .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
  .s { text-align: center; padding: 9px 4px; border-radius: 11px; background: rgba(255, 255, 255, 0.035); }
  .sv { font-size: 14.5px; font-weight: 800; font-variant-numeric: tabular-nums; }
  .sk { font-size: 9.5px; color: var(--muted); margin-top: 3px; font-weight: 700;}
  .health { font-size: 11.5px; color: var(--text-2, var(--muted)); margin-top: 12px; }
  .health.note { color: var(--muted); font-style: italic; }
  .foot { font-size: 11.5px; color: var(--muted); margin: 0; }
</style>
