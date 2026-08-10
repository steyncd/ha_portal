<script lang="ts">
  // Settings › Calendars. PLATFORM-CONCEPTS §8.
  //
  // Every row names WHAT THE CALENDAR CHANGES. That is the whole difference
  // between this and a diary: "Away" is not an event, it is a set of
  // consequences with a start and an end, and if the screen only showed dates
  // you would have to read the automations to find out what happens.
  //
  // A calendar that exists in HA but is not wired to anything renders as such,
  // rather than being hidden — the same rule as the beams sun toggle. A
  // capability you can see is better than one you cannot.
  import { ha } from "../store.svelte";
  import { CALENDARS } from "../calendars";
  import SettingRow from "./SettingRow.svelte";

  let openCal = $state<string | null>(null);

  const present = (entity: string) => ha.exists(entity);
  const active = (entity: string) => ha.exists(entity) && ha.isOn(entity);
</script>

<section class="grp">
  <h3 class="kicker">Calendars</h3>
  <p class="lead">
    Schedules attached to things. A helper cannot express "except in December" —
    which is why the school-term and holiday rules currently live as hardcoded
    date lists inside templates.
  </p>

  {#each CALENDARS as c (c.id)}
    <SettingRow
      label={c.name}
      explain={present(c.entity)
        ? `${c.purpose} · ${c.entity}${c.source === "ical" ? " · subscribed" : ""}`
        : `Needs ${c.entity} in Home Assistant. ${c.source === "ical" ? "Subscribe to the feed rather than retyping the dates." : "local_calendar is already installed."}`}
      value={present(c.entity) ? (active(c.entity) ? "On now" : `${c.effects.length} effects`) : "Not in HA"}
      warn={!present(c.entity)}
      onclick={() => (openCal = openCal === c.id ? null : c.id)}
    />
    {#if openCal === c.id}
      <div class="detail">
        <p class="dk">What it changes</p>
        {#each c.effects as e (e.text)}
          <p class="ds">
            · {e.text}
            {#if e.target}<span class="tgt">{e.target}</span>{/if}
          </p>
        {/each}
        {#if !present(c.entity)}
          <p class="ds warn">
            Not wired yet, so none of the above happens. The portal deliberately
            does not create calendars — the automation stays the single source of
            truth and the portal only reads what exists.
          </p>
        {/if}
      </div>
    {/if}
  {/each}
</section>

<section class="grp">
  <h3 class="kicker">Why not helpers</h3>
  <p class="lead">
    An <code>input_datetime</code> is a time of day. A term, a holiday and a
    service visit are date ranges with exceptions, and every attempt to model
    those as a time plus a weekday mask ends up as a template with a list of dates
    hardcoded inside it. Use <code>local_calendar</code>, which is already
    installed, plus iCal subscriptions for the school and municipal calendars so
    nobody retypes them each year.
  </p>
</section>

<style>
  .grp { margin-bottom: 22px; }
  .lead { font-size: 12px; color: var(--mut); line-height: 1.55; margin: 6px 0 8px; text-wrap: pretty; }
  .lead code { font-family: ui-monospace, monospace; font-size: 11px; color: var(--tx2); }
  .detail { padding: 8px 0 14px; }
  .dk { font-size: 11px; font-weight: 700; color: var(--tx2); margin: 0 0 5px; }
  .ds { font-size: 11.5px; color: var(--mut); margin: 4px 0; line-height: 1.5; text-wrap: pretty; }
  .ds.warn { color: var(--warn); margin-top: 9px; }
  .tgt {
    font-family: ui-monospace, monospace;
    font-size: 10.5px;
    color: var(--tx2);
    background: var(--fill);
    border-radius: var(--r-pill);
    padding: 1px 7px;
    margin-left: 6px;
  }
</style>
