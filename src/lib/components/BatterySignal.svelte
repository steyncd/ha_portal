<script lang="ts">
  // Batteries & signal — Phase 5.1.
  //
  // Level AND LQI on the same row, deliberately. Shown apart they produce the
  // wrong diagnosis: a button that misses presses looks like a dying battery, so
  // you replace the battery, and it carries on missing presses because the
  // actual fault is a 14-LQI link. Together the row says which one it is — and a
  // low LQI is a ROUTER problem, not a device problem, so the fix is moving a
  // mains-powered device nearer, not buying another button.
  //
  // Zigbee LQI is 0–255. Under about 25 is unreliable in practice on this mesh;
  // under 50 is worth watching.
  import { ha } from "../store.svelte";

  const LOW_BATT = 25;
  const BAD_LQI = 25;
  const WATCH_LQI = 50;

  type Dev = { name: string; batt: number | null; lqi: number | null; note: string };

  // Pairs battery and LQI sensors by their shared device slug. Discovered from
  // the entity list rather than hardcoded, so a new Zigbee device appears here
  // without an edit — and a hardcoded list is how the garage vibration sensor
  // went unnoticed for months.
  const devices = $derived.by<Dev[]>(() => {
    const ids = Object.keys(ha.entities);
    const batt = new Map<string, string>();
    const lqi = new Map<string, string>();
    for (const id of ids) {
      let m = id.match(/^sensor\.(.+)_battery$/);
      if (m) batt.set(m[1], id);
      m = id.match(/^sensor\.(.+)_(?:lqi|link_quality|signal_strength)$/);
      if (m) lqi.set(m[1], id);
    }
    const slugs = [...new Set([...batt.keys(), ...lqi.keys()])];
    return slugs
      .map((slug) => {
        const b = batt.get(slug) ? ha.num(batt.get(slug)!) : null;
        const q = lqi.get(slug) ? ha.num(lqi.get(slug)!) : null;
        const nice = (batt.get(slug) ?? lqi.get(slug))!;
        const name = ha.name(nice).replace(/ (battery|LQI|link quality|signal strength)$/i, "");
        // The note is the diagnosis, not a restatement of the numbers.
        let note = "";
        if (q != null && q < BAD_LQI) note = "weak link — a router nearer to it, not a new battery";
        else if (b != null && b <= LOW_BATT) note = "replace the battery";
        else if (q != null && q < WATCH_LQI) note = "link worth watching";
        return { name, batt: b, lqi: q, note };
      })
      // Only rows with something to say, worst first: a list of 40 healthy
      // devices buries the two that need doing.
      .filter((d) => d.note || (d.batt != null && d.batt <= 40))
      .sort((a, b) => (a.lqi ?? 999) - (b.lqi ?? 999) || (a.batt ?? 999) - (b.batt ?? 999));
  });
</script>

<section class="bs">
  <h3 class="kicker">Batteries &amp; signal</h3>
  {#if devices.length === 0}
    <p class="ok">Every battery is above 40% and every link is healthy.</p>
  {:else}
    <p class="lead">
      Level and link strength together — apart, a weak link looks like a flat
      battery, and you replace the wrong thing.
    </p>
    {#each devices as d (d.name)}
      <div class="row" class:warn={d.lqi != null && d.lqi < BAD_LQI}>
        <span class="body">
          <span class="n">{d.name}</span>
          {#if d.note}<span class="note">{d.note}</span>{/if}
        </span>
        <span class="nums">
          {#if d.batt != null}
            <span class="v" class:low={d.batt <= LOW_BATT}>{Math.round(d.batt)}%</span>
          {:else}<span class="v none">—</span>{/if}
          {#if d.lqi != null}
            <span class="v lqi" class:low={d.lqi < BAD_LQI}>LQI {Math.round(d.lqi)}</span>
          {/if}
        </span>
      </div>
    {/each}
  {/if}
</section>

<style>
  .bs { background: var(--s1); border-radius: var(--r-surface); padding: 15px 16px; }
  .lead { font-size: 11.5px; color: var(--mut); line-height: 1.5; margin: 6px 0 8px; text-wrap: pretty; }
  .ok { font-size: 12.5px; color: var(--mut); margin: 6px 0 0; }
  .row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 9px 0;
    border-bottom: 1px solid var(--line);
  }
  .row:last-child { border-bottom: 0; }
  .row.warn { box-shadow: inset 2px 0 0 var(--warn); padding-left: 9px; }
  .body { flex: 1; min-width: 0; }
  .n { display: block; font-size: 12.5px; font-weight: 700; color: var(--tx); }
  .note { display: block; font-size: 11px; color: var(--mut); margin-top: 2px; }
  .nums { flex: none; display: flex; gap: 6px; align-items: baseline; }
  .v { font-size: 12px; font-weight: 700; color: var(--tx2); font-variant-numeric: tabular-nums; }
  .v.lqi { font-size: 11px; color: var(--mut); }
  .v.low { color: var(--warn); }
  .v.none { color: var(--mut); }
</style>
