<script lang="ts">
  // Settings › Twins. PLATFORM-CONCEPTS §1.
  //
  // Five shapes, sixty-five things. The screen's job is to make the COVERAGE
  // visible — which slots are bound, which are genuinely absent, and what each
  // instance gets for free by being an instance.
  //
  // The unbound count is the useful number here, and it is deliberately not
  // styled as a fault: Eben's room has no humidity sensor and Bath has no
  // temperature sensor, and those are facts about the house rather than gaps in
  // the model. An amber warning on every optional slot would make the screen
  // unreadable and teach you to ignore it.
  import { ha } from "../store.svelte";
  import { TEMPLATES, totalExpected } from "../twins/templates";
  import { INSTANCES, instancesOf, unbound } from "../twins/instances";
  import { dependentCount } from "../deps";
  import SettingRow from "./SettingRow.svelte";

  let openTpl = $state<string | null>(null);

  // Does every bound slot point at something that actually exists? This is the
  // check worth having, as opposed to counting optional absences.
  function brokenSlots(): { instance: string; slot: string; id: string }[] {
    const out: { instance: string; slot: string; id: string }[] = [];
    for (const i of INSTANCES) {
      for (const [slot, v] of Object.entries(i.slots)) {
        if (v == null) continue;
        for (const id of Array.isArray(v) ? v : [v]) {
          // exists() is the portal's own view of the state machine — the only
          // reliable existence test, since the entity registry omits MQTT and
          // YAML entities without unique_ids.
          if (!ha.exists(id)) out.push({ instance: i.name, slot, id });
        }
      }
    }
    return out;
  }
  const broken = $derived(brokenSlots());
</script>

<section class="grp">
  <h3 class="kicker">Coverage</h3>
  <p class="lead">
    Five shapes describe {totalExpected} real things. Adding a room should be one
    object in <code>instances.ts</code> — and that room then arrives already
    knowing how to be stale, how to be put under maintenance, and how to appear
    on the plan.
  </p>
  {#each TEMPLATES as t (t.id)}
    {@const inst = instancesOf(t.id)}
    <SettingRow
      label={t.name}
      explain={`${inst.length} of ${t.expected} bound · ${t.slots.length} slots · inherits ${t.inherits.length} behaviours`}
      value={openTpl === t.id ? "Hide" : "Show"}
      onclick={() => (openTpl = openTpl === t.id ? null : t.id)}
    />
    {#if openTpl === t.id}
      <div class="detail">
        <p class="dk">Slots</p>
        {#each t.slots as s (s.key)}
          <p class="ds">
            <span class="sk">{s.key}</span>
            {s.domain}{#if s.optional} · optional{/if} — {s.purpose}
          </p>
        {/each}

        <p class="dk">Every instance inherits</p>
        {#each t.inherits as h (h)}
          <p class="ds">· {h}</p>
        {/each}

        <p class="dk">Instances</p>
        {#each inst as i (i.id)}
          {@const missing = unbound(i)}
          <p class="ds">
            <span class="sk">{i.name}</span>
            {#if missing.length}
              no {missing.join(", ")}
            {:else}
              all slots bound
            {/if}
          </p>
        {/each}
      </div>
    {/if}
  {/each}
</section>

<section class="grp">
  <h3 class="kicker">Bindings that point at nothing</h3>
  {#if broken.length === 0}
    <p class="lead">
      Every bound slot resolves to a live entity. Optional slots left empty are
      not listed — Eben's room genuinely has no humidity sensor, and flagging
      that as a fault would make this screen noise.
    </p>
  {:else}
    <p class="lead">
      These slots name an entity the portal cannot see. Each one is a silent
      em-dash somewhere in the app.
    </p>
    {#each broken as b (b.instance + b.slot + b.id)}
      <SettingRow label={`${b.instance} · ${b.slot}`} explain={b.id} value="Missing" warn />
    {/each}
  {/if}
</section>

<section class="grp">
  <h3 class="kicker">Why this exists</h3>
  <p class="lead">
    Adding a room today means edits in <code>entities.ts</code>, a package, a view
    and a chart. That is why <code>feature_solcast.yaml</code>,
    <code>solar_forecast.yaml</code> and <code>feature_solar_intel.yaml</code> all
    exist: three files of the same shape with different ids, because there was no
    shape to instantiate. The most-referenced entity in the house has
    {dependentCount("sensor.victron_battery_soc")} readers — that is the cost of
    hand-wiring.
  </p>
</section>

<style>
  .grp { margin-bottom: 22px; }
  .lead { font-size: 12px; color: var(--mut); line-height: 1.55; margin: 6px 0 8px; text-wrap: pretty; }
  .lead code, .ds code { font-family: ui-monospace, monospace; font-size: 11px; color: var(--tx2); }
  .detail { padding: 10px 0 14px; }
  .dk { font-size: 11px; font-weight: 700; color: var(--tx2); margin: 12px 0 5px; }
  .dk:first-child { margin-top: 0; }
  .ds { font-size: 11.5px; color: var(--mut); margin: 3px 0; line-height: 1.5; text-wrap: pretty; }
  .sk {
    display: inline-block;
    padding: 1px 7px;
    border-radius: var(--r-pill);
    background: var(--fill);
    color: var(--tx2);
    font-weight: 700;
    margin-right: 6px;
    font-family: ui-monospace, monospace;
    font-size: 10.5px;
  }
</style>
