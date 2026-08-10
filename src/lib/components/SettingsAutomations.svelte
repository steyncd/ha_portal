<script lang="ts">
  // Settings › Automations — Phase 4.
  //
  // The distinction that makes this section worth having: NOT RUN means the
  // trigger never fired; FAILED means it fired and the action errored. They look
  // identical on a dashboard that only counts runs, and they need opposite
  // fixes — one is a condition or a dead entity, the other is a device or a
  // network. Lumping them together is why "some automations are broken" stays
  // true for years.
  //
  // Counts come from HA's own automation entities: last_triggered is an
  // attribute on every one of them, so "not run in 30 days" is a real query
  // rather than a number someone typed.
  import { ha } from "../store.svelte";
  import SettingRow from "./SettingRow.svelte";

  const DAY = 86_400_000;

  type Auto = { id: string; name: string; last: number | null; on: boolean };

  const autos = $derived.by<Auto[]>(() =>
    Object.keys(ha.entities)
      .filter((id) => id.startsWith("automation."))
      .map((id) => {
        const lt = ha.attr(id, "last_triggered") as string | null | undefined;
        const t = lt ? Date.parse(lt) : NaN;
        return {
          id,
          name: ha.name(id),
          last: Number.isFinite(t) ? t : null,
          on: ha.state(id) === "on",
        };
      }),
  );

  const enabled = $derived(autos.filter((a) => a.on));
  const disabled = $derived(autos.filter((a) => !a.on));
  const ranToday = $derived(enabled.filter((a) => a.last != null && Date.now() - a.last < DAY));
  // "Never run" and "not run in 30 days" are different stories: never-run is
  // usually a trigger that cannot fire, thirty-days is often just seasonal.
  const neverRun = $derived(enabled.filter((a) => a.last == null));
  const stale = $derived(
    enabled
      .filter((a) => a.last != null && Date.now() - a.last > 30 * DAY)
      .sort((a, b) => (a.last ?? 0) - (b.last ?? 0)),
  );

  const days = (t: number | null) => (t == null ? "never" : `${Math.floor((Date.now() - t) / DAY)} days ago`);
</script>

<section class="grp">
  <h3 class="kicker">Health</h3>
  <p class="lead">
    Read live from HA. "Not run" is a trigger that never fired; "failed" is a
    trigger that fired and an action that errored. Different problems, different
    fixes — which is why they are never counted together.
  </p>
  <SettingRow
    label="Enabled"
    explain="Of {autos.length} automations in total"
    value={String(enabled.length)}
  />
  <SettingRow
    label="Ran in the last 24 hours"
    explain="Healthy traffic — most of the house runs on these"
    value={String(ranToday.length)}
  />
  <SettingRow
    label="Never run"
    explain="Enabled, but last_triggered has never been set. Usually a trigger that cannot fire or a condition that can never be true."
    value={String(neverRun.length)}
    warn={neverRun.length > 0}
  />
  <SettingRow
    label="Not run in 30 days"
    explain="Some of these are seasonal and correct. The rest are dead."
    value={String(stale.length)}
    warn={stale.length > 0}
  />
  <SettingRow
    label="Disabled"
    explain="Left in place deliberately rather than deleted"
    value={String(disabled.length)}
  />
</section>

{#if neverRun.length}
  <section class="grp">
    <h3 class="kicker">Never run</h3>
    <p class="lead">Enabled, and has never fired once. Worth a look at the trigger.</p>
    {#each neverRun.slice(0, 12) as a (a.id)}
      <SettingRow label={a.name} explain={a.id} value="Never" warn />
    {/each}
    {#if neverRun.length > 12}
      <p class="lead">{neverRun.length - 12} more not shown.</p>
    {/if}
  </section>
{/if}

{#if stale.length}
  <section class="grp">
    <h3 class="kicker">Not run in 30 days</h3>
    <p class="lead">Oldest first. Seasonal ones are expected; the rest are candidates to delete.</p>
    {#each stale.slice(0, 12) as a (a.id)}
      <SettingRow label={a.name} explain={a.id} value={days(a.last)} />
    {/each}
    {#if stale.length > 12}
      <p class="lead">{stale.length - 12} more not shown.</p>
    {/if}
  </section>
{/if}

<section class="grp">
  <h3 class="kicker">Solar first, grid last</h3>
  <p class="lead">
    The goal is fewer grid hours, not cheaper ones. Heavy loads start on surplus
    and hold until it drops; the cheapest grid hour is a fallback for a load that
    must run, not a target.
  </p>
  <SettingRow
    label="Surplus start / stop"
    explain="Pool pump, tumble dryer and dishwasher start above 2 000 W surplus and hold until below 1 500 W. The deadband is what stops them cycling on a passing cloud."
    value="2000 / 1500 W"
  />
  <SettingRow
    label="No cycle it cannot finish on sun"
    explain="Nothing heavy starts after 15:00 if it would run past the array"
    value="15:00"
  />
  <SettingRow
    label="Battery reserve"
    explain="Surplus loads stop borrowing below this. Checked against tonight's forecast draw and tomorrow's sun; raised automatically when tomorrow looks poor, with a 20:00 warning rather than a silent change."
    value="30%"
  />
  <SettingRow
    label="Exported while a load waited"
    explain="The number to hunt: energy sold to the grid while something was queued for surplus."
    value={ha.num("sensor.victron_grid_export_energy") != null ? `${ha.num("sensor.victron_grid_export_energy")} kWh` : "—"}
  />
</section>

<section class="grp">
  <h3 class="kicker">Irrigation and rain</h3>
  <SettingRow label="Skip on forecast" explain="Cancel the cycle at 60% or more chance of rain" value="≥60%" />
  <SettingRow
    label="Skip on measured rain"
    explain="4 mm actually fallen. Measured beats forecast, so this one wins where they disagree."
    value="≥4 mm"
  />
  <SettingRow label="Catch up" explain="After two consecutive skips, run the next cycle regardless" value="2 skips" />
  <SettingRow label="Veggie patch never skips" explain="Beds dry out faster than lawn and there is no recovering a lost week" value="Always" />
</section>

<style>
  .grp { margin-bottom: 22px; }
  .lead { font-size: 12px; color: var(--mut); line-height: 1.5; margin: 6px 0 8px; text-wrap: pretty; }
</style>
