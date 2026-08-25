<script lang="ts">
  // Settings › Notify — every notification switch the house has, as a matrix.
  //
  // THE SHAPE OF THE PROBLEM. The house has 77 notify_* helpers arranged as
  // category x channel x person. That is right for the automations reading them
  // and wrong for the question a person asks, which is never "what is
  // notify_inverter_whatsapp_mandri" — it is "stop sending Mandri WhatsApps".
  // So the destinations are COLUMNS you can act on as a whole, and the
  // categories are rows. Every switch here is one an automation already reads;
  // nothing was invented to fill the grid.
  //
  // NOT EVERY CELL EXISTS, and an absent cell is not an "off" cell. Gate AI is
  // WhatsApp-only; Energy has no Mandri push. Those render as an em-dash meaning
  // "this category never sends there", which is a different fact from "switched
  // off" and must not look the same.
  //
  // SOME CELLS MOVE BOTH PEOPLE. notify_alarm_push is a single switch with no
  // person in its name, so it appears under both Christo and Mandri and is
  // marked as shared — silently moving Mandri when Christo was tapped would be
  // the worst thing this screen could do.
  //
  // FRICTION MATCHED TO BLAST RADIUS. Turning a whole destination ON needs no
  // confirmation. Turning one OFF can silence alarm, emergency, safety and
  // security in one tap, so it asks first and says how many critical categories
  // it is about to mute.
  import { ha } from "../store.svelte";
  import { buildMatrix, DESTS, destKey, columnIds, isCritical, prettify, type Row } from "../notifications";
  import { toast } from "../toast.svelte";
  import SettingRow from "./SettingRow.svelte";

  const built = $derived(buildMatrix(Object.keys(ha.entities)));
  const rows = $derived(built.rows);
  const flags = $derived(built.flags);

  const on = (id: string | undefined) => (id ? ha.isOn(id) : false);

  /** How many switches in this column are on, and how many exist. */
  function colState(d: (typeof DESTS)[number]) {
    const ids = columnIds(rows, d);
    return { total: ids.length, on: ids.filter((i) => ha.isOn(i)).length, ids };
  }

  let confirming = $state<string | null>(null);
  let timer: ReturnType<typeof setTimeout>;

  async function setColumn(d: (typeof DESTS)[number], want: boolean) {
    const { ids } = colState(d);
    if (!ids.length) return;

    // Off is the direction that can cost you something, so it asks once.
    if (!want) {
      const key = destKey(d);
      if (confirming !== key) {
        confirming = key;
        clearTimeout(timer);
        timer = setTimeout(() => (confirming = null), 4500);
        return;
      }
      clearTimeout(timer);
      confirming = null;
    }

    for (const id of ids) {
      ha.setBoolean(id, want);
      // Spaced lightly. These are local helpers rather than the Olarm panel, but
      // seventeen writes in one tick still arrives as a burst.
      await new Promise((r) => setTimeout(r, 90));
    }
    toast.show(`${d.label} ${want ? "on" : "off"} — ${ids.length} switch${ids.length === 1 ? "" : "es"}`);
  }

  /** Critical categories that a column would mute, for the confirm wording. */
  function criticalIn(d: (typeof DESTS)[number]): string[] {
    return rows.filter((r) => isCritical(r.key) && r.cells[destKey(d)] && ha.isOn(r.cells[destKey(d)]!.id)).map((r) => r.label);
  }

  function cellLabel(r: Row, d: (typeof DESTS)[number]) {
    const c = r.cells[destKey(d)];
    if (!c) return null;
    return c;
  }
</script>

<p class="lead">
  Every notification switch the house has — {rows.length} categories across the six
  destinations, plus {flags.length} other settings. These are the same helpers the
  automations read, so a change here takes effect on the next alert.
</p>

<!-- Destination columns first: this is the control the request was actually about. -->
<div class="card pad">
  <div class="lb">Turn a destination on or off</div>
  <div class="dgrid">
    {#each DESTS as d (destKey(d))}
      {@const st = colState(d)}
      {@const crit = criticalIn(d)}
      <div class="dcard" class:none={st.total === 0}>
        <div class="dl">{d.label}</div>
        <div class="dc">
          {#if st.total === 0}
            nothing sends here
          {:else}
            <strong>{st.on}</strong> of {st.total} on
          {/if}
        </div>
        {#if st.total > 0}
          <div class="dbtns">
            <button onclick={() => setColumn(d, true)}>All on</button>
            <button
              class="off"
              class:confirm={confirming === destKey(d)}
              onclick={() => setColumn(d, false)}
            >{confirming === destKey(d) ? "Tap to confirm" : "All off"}</button>
          </div>
          {#if confirming === destKey(d) && crit.length}
            <div class="dwarn">
              This also silences {crit.join(", ")} for {d.label}.
            </div>
          {/if}
        {/if}
      </div>
    {/each}
  </div>
</div>

<!-- The matrix. Horizontally scrollable with a pinned first column, because six
     destination columns will not fit a phone and squeezing them makes every cell
     an ambiguous tap target. -->
<div class="card pad">
  <div class="rh">
    <span class="lb">Every category</span>
    <span class="sub">— means this category never sends there</span>
  </div>

  <div class="scroll">
    <table>
      <thead>
        <tr>
          <th class="pin">Category</th>
          {#each DESTS as d (destKey(d))}
            <th><span class="who">{d.person === "christo" ? "Christo" : "Mandri"}</span><span class="ch">{d.short}</span></th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each rows as r (r.key)}
          <tr class:crit={isCritical(r.key)}>
            <th class="pin">
              <span class="cat">{r.label}</span>
              {#if isCritical(r.key)}<span class="tag">urgent</span>{/if}
              {#if r.master}
                <button class="mini" class:on={on(r.master)} onclick={() => ha.setBoolean(r.master!, !on(r.master))}>
                  {on(r.master) ? "enabled" : "disabled"}
                </button>
              {/if}
            </th>
            {#each DESTS as d (destKey(d))}
              {@const c = cellLabel(r, d)}
              <td>
                {#if !c}
                  <span class="absent" title="{r.label} never sends to {d.label}">—</span>
                {:else}
                  <button
                    class="cell"
                    class:on={ha.isOn(c.id)}
                    title={c.shared ? `${c.id} — one switch for both people` : c.id}
                    onclick={() => ha.setBoolean(c.id, !ha.isOn(c.id))}
                  >
                    {ha.isOn(c.id) ? "on" : "off"}{#if c.shared}<span class="both">both</span>{/if}
                  </button>
                {/if}
              </td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <div class="note">
    <strong>both</strong> marks a single switch with no person in its name — HA has
    one toggle for that category and channel, so it moves Christo and Mandri
    together. Tapping it under one name changes the other too.
  </div>

  {#each rows.filter((r) => Object.keys(r.perPerson).length) as r (r.key)}
    <div class="note">
      <strong>{r.label}</strong> also has a per-person master that covers every
      channel:
      {#each Object.entries(r.perPerson) as [p, id] (id)}
        <button class="mini" class:on={on(id)} onclick={() => ha.setBoolean(id, !on(id))}>
          {prettify(p)} {on(id) ? "on" : "off"}
        </button>
      {/each}
    </div>
  {/each}
</div>

{#if flags.length}
  <div class="card pad">
    <div class="lb" style="margin-bottom:4px">Other notification settings</div>
    {#each flags as id (id)}
      <SettingRow
        label={ha.name(id)}
        explain={id}
        value={ha.isOn(id) ? "On" : "Off"}
        onclick={() => ha.setBoolean(id, !ha.isOn(id))}
      />
    {/each}
  </div>
{/if}

<style>
  .lead { font-size: 12px; color: var(--mut, var(--text-3)); line-height: 1.55; margin: 0 0 14px; text-wrap: pretty; }
  .lb { font-size: 11px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: var(--acc); }
  .sub { font-size: 11px; color: var(--text-3); }
  .rh { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; flex-wrap: wrap; }
  .card + .card { margin-top: 14px; }

  .dgrid { display: grid; grid-template-columns: repeat(auto-fit, minmax(168px, 1fr)); gap: 9px; margin-top: 12px; }
  .dcard { padding: 12px; border-radius: 11px; background: rgba(255, 255, 255, 0.045); }
  .dcard.none { opacity: 0.55; }
  .dl { font-size: 12.5px; font-weight: 800; color: var(--text); }
  .dc { font-size: 11.5px; color: var(--text-3); margin-top: 3px; }
  .dc strong { color: var(--text); }
  .dbtns { display: flex; gap: 6px; margin-top: 10px; }
  .dbtns button { flex: 1; padding: 7px 6px; border-radius: 8px; background: rgba(255, 255, 255, 0.08); font-size: 11.5px; font-weight: 700; color: var(--text); min-height: 38px; }
  .dbtns .off { background: color-mix(in srgb, var(--warning) 16%, transparent); }
  .dbtns .off.confirm { background: var(--warning); color: #10131a; }
  .dwarn { margin-top: 8px; font-size: 11px; line-height: 1.45; color: var(--warning); text-wrap: pretty; }

  .scroll { overflow-x: auto; margin-top: 12px; }
  table { border-collapse: collapse; width: 100%; min-width: 560px; }
  th, td { padding: 7px 8px; text-align: center; }
  thead th { font-size: 10.5px; font-weight: 700; color: var(--text-3); border-bottom: 1px solid var(--line, rgba(255,255,255,0.08)); }
  thead .who { display: block; color: var(--text-2); }
  thead .ch { display: block; font-weight: 500; }
  .pin { position: sticky; left: 0; text-align: left; background: var(--s1, #191b20); z-index: 1; }
  tbody .pin { display: table-cell; }
  .cat { font-size: 12.5px; font-weight: 700; color: var(--text); }
  .tag { display: inline-block; margin-left: 6px; padding: 1px 6px; border-radius: 999px; font-size: 9.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; background: color-mix(in srgb, var(--warning) 20%, transparent); color: var(--warning); }
  tbody tr { border-bottom: 1px solid var(--line, rgba(255,255,255,0.05)); }
  .cell {
    min-width: 54px; padding: 6px 8px; border-radius: 8px; min-height: 36px;
    background: rgba(255, 255, 255, 0.06); color: var(--text-3);
    font-size: 11.5px; font-weight: 700;
  }
  .cell.on { background: color-mix(in srgb, var(--acc) 26%, transparent); color: var(--text); }
  .both { display: block; font-size: 9px; font-weight: 700; opacity: 0.75; }
  .absent { color: var(--text-3); opacity: 0.5; font-size: 13px; }
  .mini { margin-left: 8px; padding: 3px 9px; border-radius: 7px; background: rgba(255,255,255,0.07); font-size: 10.5px; font-weight: 700; color: var(--text-3); min-height: 28px; }
  .mini.on { background: color-mix(in srgb, var(--acc) 24%, transparent); color: var(--text); }
  .note { font-size: 11.5px; color: var(--text-3); line-height: 1.55; margin-top: 12px; text-wrap: pretty; }
</style>
