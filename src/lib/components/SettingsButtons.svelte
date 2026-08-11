<script lang="ts">
  // Settings › Buttons — remap what each Zigbee button press does.
  //
  // WHAT THIS SCREEN WRITES: one input_text per press, holding a script
  // entity_id. Nothing else. It does not edit automations, and it cannot — the
  // dispatcher in packages/feature_button_mapping.yaml reads the helper and is
  // only able to call `script.*`, so no assignment made here can reach a raw
  // alarm_arm_*/alarm_disarm call. That matters on this IDS panel, where an arm
  // command sent to an already-armed area disarms it.
  //
  // EMPTY MEANS BUILT-IN, NOT BROKEN. Clearing a mapping hands the press back to
  // the automation that has always handled it, and that automation's real
  // behaviour is printed on the row so you can see what you are giving up or
  // getting back. A remapper that showed "unassigned" for eleven of twelve
  // presses would be lying about a house where every press already does
  // something.
  //
  // The script list is read live from Home Assistant. There is no hard-coded
  // list of scripts here — a script added in HA this afternoon is in the picker.
  import { ha } from "../store.svelte";
  import { BUTTONS, helperFor, ALL_PRESSES, assignableScripts, type Press } from "../buttons";
  import SettingRow from "./SettingRow.svelte";
  import { toast } from "../toast.svelte";

  let open = $state<string | null>(null);
  let q = $state("");
  let busy = $state<string | null>(null);

  /** Every script HA currently has, newest list on every poll. */
  const scripts = $derived(assignableScripts(Object.keys(ha.entities)));

  const nameOf = (id: string) =>
    (ha.attr(id, "friendly_name") as string) ||
    id.replace(/^script\./, "").replace(/_/g, " ");

  /** A YAML input_text has no value until something writes one, so a freshly
   *  reloaded helper reads 'unknown' — which is truthy, and rendered the literal
   *  word "unknown" on the last-dispatch row until the render-check caught it. */
  const value = (id: string) => {
    const v = ha.state(id);
    if (!v || ["unknown", "unavailable", "none", "None"].includes(v)) return null;
    return v.trim() || null;
  };

  const mapped = (p: Press) => value(helperFor(p.key));

  /** A mapping whose script no longer exists. The press silently does nothing —
   *  which is the safe behaviour, but it must be visible somewhere, and this is
   *  the somewhere. HA also raises a notification at 09:15. */
  const stale = (p: Press) => {
    const m = mapped(p);
    return !!m && !ha.exists(m);
  };

  /** Helpers not loaded yet — the package has not been added or HA not reloaded.
   *  Worth saying plainly rather than rendering twelve rows that do nothing. */
  const ready = $derived(ALL_PRESSES.some((p) => ha.exists(helperFor(p.key))));
  const changed = $derived(ALL_PRESSES.filter((p) => mapped(p)).length);

  const shown = $derived.by(() => {
    const t = q.trim().toLowerCase();
    const list = t
      ? scripts.filter((id) => id.toLowerCase().includes(t) || nameOf(id).toLowerCase().includes(t))
      : scripts;
    // Capped, with the count stated — a picker that silently shows the first 60
    // of 101 is how you conclude a script does not exist.
    return { list: list.slice(0, 60), total: list.length };
  });

  async function assign(p: Press, id: string) {
    // Captured BEFORE the write. The first version read mapped(p) inside the undo
    // closure, which runs after the write has landed — so "undo" restored the
    // value it had just set, silently doing nothing. Same mistake as the toggle
    // undo in the store, and the same fix.
    const prev = mapped(p);
    busy = p.key;
    try {
      await ha.setText(helperFor(p.key), id);
      open = null;
      q = "";
      toast.showUndo(`${p.label} → ${nameOf(id)}`, async () => {
        await ha.setText(helperFor(p.key), prev ?? "");
      });
    } finally {
      busy = null;
    }
  }

  async function reset(p: Press) {
    const prev = mapped(p);
    busy = p.key;
    try {
      await ha.setText(helperFor(p.key), "");
      open = null;
      toast.showUndo(`${p.label} back to built-in`, async () => {
        if (prev) await ha.setText(helperFor(p.key), prev);
      });
    } finally {
      busy = null;
    }
  }
</script>

<p class="lead">
  Each press can be pointed at any script in Home Assistant. Leave a press alone
  and it keeps doing what it does today — the built-in behaviour is printed on
  every row, so you can see exactly what you are replacing.
</p>

{#if !ready}
  <SettingRow
    label="The helpers are not loaded yet"
    explain="This screen writes input_text.btn_* helpers, and Home Assistant does not have them. Add packages/feature_button_mapping.yaml and reload — Developer Tools › YAML › Input Text, or restart. Until then every press keeps its built-in behaviour, which is why nothing is broken in the meantime."
    value="Set up"
    warn
  />
{/if}

{#each BUTTONS as b (b.id)}
  <section class="grp">
    <h3 class="kicker">{b.name}</h3>
    <p class="sub">{b.model} · {b.where}</p>

    {#each b.presses as p (p.key)}
      {@const m = mapped(p)}
      {@const bad = stale(p)}
      <div class="press" class:isopen={open === p.key}>
        <SettingRow
          label={p.label}
          explain={m
            ? bad
              ? `Points at ${m}, which no longer exists in Home Assistant — this press currently does nothing. Pick another script, or reset it to the built-in.`
              : `Runs ${nameOf(m)} (${m}). Built-in behaviour, which this replaces: ${p.current}`
            : p.current}
          value={m ? (bad ? "Broken" : "Custom") : "Built-in"}
          warn={bad || (!m && p.security)}
          onclick={() => { open = open === p.key ? null : p.key; q = ""; }}
        />

        {#if open === p.key}
          <div class="panel">
            {#if p.security}
              <p class="warn">
                This press changes the alarm today — {p.current.toLowerCase()}.
                Remapping it means that no longer happens. Whatever you choose
                still goes through the safe wrappers, so it cannot toggle an
                already-armed area, but it also will not disarm the house unless
                the script you pick does.
              </p>
            {/if}

            <input
              class="q"
              type="search"
              placeholder="Search {scripts.length} scripts"
              bind:value={q}
              autocomplete="off"
            />

            {#if !scripts.length}
              <p class="none">No scripts loaded from Home Assistant yet.</p>
            {:else if !shown.list.length}
              <p class="none">Nothing matches “{q}”.</p>
            {:else}
              <div class="opts">
                {#each shown.list as id (id)}
                  <button
                    class="opt"
                    class:on={m === id}
                    disabled={busy === p.key}
                    onclick={() => assign(p, id)}
                  >
                    <span class="on-name">{nameOf(id)}</span>
                    <span class="on-id">{id.replace(/^script\./, "")}</span>
                  </button>
                {/each}
              </div>
              {#if shown.total > shown.list.length}
                <p class="none">
                  Showing 60 of {shown.total}. Narrow the search to see the rest.
                </p>
              {/if}
            {/if}

            {#if m}
              <button class="reset" disabled={busy === p.key} onclick={() => reset(p)}>
                Reset to built-in — {p.current}
              </button>
            {/if}
          </div>
        {/if}
      </div>
    {/each}
  </section>
{/each}

<section class="grp">
  <h3 class="kicker">State</h3>
  <SettingRow
    label="Presses remapped"
    explain="Out of {ALL_PRESSES.length} across the three buttons. The rest run their built-in automation."
    value={`${changed} of ${ALL_PRESSES.length}`}
  />
  {#if ha.exists("input_text.btn_last_dispatch")}
    <SettingRow
      label="Last remapped press that fired"
      explain="Written by the dispatcher itself. If you press a remapped button and this does not change, the press is not reaching Home Assistant — check the button's battery in Diagnostics › Zigbee mesh."
      value={value("input_text.btn_last_dispatch") ?? "none yet"}
    />
  {/if}
  <SettingRow
    label="A press cannot reach the alarm directly"
    explain="The dispatcher only calls script.*, never alarm_arm_* or alarm_disarm. Every alarm script in this house checks state before sending, because on this panel an arm command to an already-armed area disarms it."
    value="Guard"
    lock
  />
</section>

<style>
  .lead { font-size: 12px; color: var(--mut); line-height: 1.55; margin: 0 0 16px; text-wrap: pretty; }
  .grp { margin-bottom: 22px; }
  .sub { font-size: 11.5px; color: var(--mut); margin: 5px 0 8px; }
  .press.isopen { background: var(--s1); border-radius: var(--r-surface); padding: 0 12px; margin: 6px -12px; }
  .panel { padding: 4px 0 14px; }
  .warn {
    font-size: 11.5px;
    color: var(--warn);
    line-height: 1.55;
    margin: 0 0 10px;
    padding: 9px 11px;
    border-radius: var(--r-control);
    background: color-mix(in srgb, var(--warn) 10%, transparent);
    text-wrap: pretty;
  }
  .q {
    width: 100%;
    padding: 9px 11px;
    border-radius: var(--r-control);
    background: var(--s2);
    border: 1px solid var(--line);
    color: var(--tx);
    font-size: 13px;
    min-height: 40px;
  }
  .opts { display: grid; gap: 2px; margin-top: 8px; max-height: 320px; overflow-y: auto; }
  .opt {
    display: flex;
    align-items: baseline;
    gap: 8px;
    width: 100%;
    text-align: left;
    padding: 9px 10px;
    border-radius: var(--r-control);
    background: transparent;
    min-height: 40px;
  }
  .opt:hover { background: var(--s2); }
  .opt.on { background: var(--fill-strong); }
  .on-name { flex: 1; min-width: 0; font-size: 12.5px; font-weight: 700; color: var(--tx); }
  .on-id { flex: none; font-size: 10.5px; color: var(--mut); font-family: ui-monospace, monospace; }
  .none { font-size: 11.5px; color: var(--mut); margin: 9px 2px 0; }
  .reset {
    width: 100%;
    margin-top: 10px;
    padding: 10px;
    border-radius: var(--r-control);
    background: var(--fill);
    color: var(--mut);
    font-size: 12px;
    font-weight: 700;
    min-height: 40px;
    text-align: left;
  }
</style>
