<script lang="ts">
  // The hub board — Phase 3.2.
  //
  // Every hub renders the same three-part shape, because the shape IS the
  // argument: four stat cards that each drill to layer 2, one detail list, and a
  // note column that names what the hub collapsed and where those views went.
  //
  // The note column is not decoration. Nine rail items where there were eighteen
  // is a change that looks like deletion unless something on the screen says
  // otherwise. Naming the folded views — and saying they still deep-link — is
  // what makes the collapse legible instead of alarming.
  import type { Snippet } from "svelte";
  import { collapsedCount, NAV, type ViewId } from "../nav";
  import Value from "./Value.svelte";
  import type { Reading } from "../freshness";

  export type Stat = {
    key: string;
    /** Pre-formatted headline, or a Reading for freshness-aware rendering. */
    value?: string;
    reading?: Reading<number | string | null>;
    unit?: string;
    /** Second line: the OTHER units. Money and kWh, always both. */
    units?: string;
    /** Third line: the one thing worth saying about it. */
    note?: string;
    /** Amber only for attention; otherwise leave it and let it stay neutral. */
    warn?: boolean;
    /** Layer-2 payload. */
    open?: () => void;
  };

  export type Row = {
    key: string;
    sub?: string;
    value?: string;
    tint?: string;
    warn?: boolean;
    open?: () => void;
  };

  let {
    hub,
    sub = "",
    stats = [],
    listTitle = "",
    rows = [],
    noteTitle = "",
    note = "",
    multiples,
    onnav,
  }: {
    hub: ViewId;
    sub?: string;
    stats?: Stat[];
    listTitle?: string;
    rows?: Row[];
    noteTitle?: string;
    note?: string;
    /** Optional small-multiples strip; rendered above the list. */
    multiples?: Snippet;
    onnav: (id: string) => void;
  } = $props();

  const item = $derived(NAV.find((n) => n.id === hub));
  const count = $derived(collapsedCount(hub));
  const folded = $derived(
    (item?.collapsed ?? []).map((id) => NAV.find((n) => n.id === id)).filter(Boolean),
  );
</script>

<div class="board">
  <header class="bh">
    <h1>{item?.name ?? ""}</h1>
    {#if sub}<p class="bsub">{sub}</p>{/if}
  </header>

  <div class="cols">
    <div class="main">
      <!-- Four stat cards. Fixed four, not auto-fit: the cardinality is known,
           and auto-fit orphans the fourth card at awkward widths. -->
      <div class="stats">
        {#each stats as s (s.key)}
          <button class="stat" class:warn={s.warn} onclick={() => s.open?.()} disabled={!s.open}>
            <span class="s-k">{s.key}</span>
            <span class="big">
              {#if s.reading}<Value reading={s.reading} unit={s.unit ?? ""} />{:else}{s.value ?? "—"}{/if}
            </span>
            <!-- Both units, always: rands so Mandri can read it, kWh and the
                 grid/sun split so Christo can. -->
            {#if s.units}<span class="s-u">{s.units}</span>{/if}
            {#if s.note}<span class="s-n" class:warn={s.warn}>{s.note}</span>{/if}
          </button>
        {/each}
      </div>

      {#if multiples}{@render multiples()}{/if}

      {#if rows.length}
        <section class="list">
          {#if listTitle}<h2>{listTitle}</h2>{/if}
          {#each rows as r (r.key)}
            <button class="row" class:warn={r.warn} onclick={() => r.open?.()} disabled={!r.open}>
              <span class="r-bar" style={r.tint ? `background:${r.tint}` : ""}></span>
              <span class="r-body">
                <span class="r-k">{r.key}</span>
                {#if r.sub}<span class="r-s">{r.sub}</span>{/if}
              </span>
              {#if r.value}<span class="r-v">{r.value}</span>{/if}
            </button>
          {/each}
        </section>
      {/if}
    </div>

    <aside class="note">
      {#if noteTitle}<p class="kicker">{noteTitle}</p>{/if}
      {#if note}<p class="n-body">{note}</p>{/if}
      {#if count}
        <p class="n-folded">
          {count} view{count > 1 ? "s" : ""} folded in here.
          They still exist and still deep-link — they just left the sidebar.
        </p>
        <div class="chips">
          {#each folded as f (f!.id)}
            <button class="chip" onclick={() => onnav(f!.id)}>{f!.name}</button>
          {/each}
        </div>
      {/if}
    </aside>
  </div>
</div>

<style>
  .board { display: flex; flex-direction: column; gap: 16px; }
  .bh h1 { font-size: 24px; font-weight: 800; letter-spacing: -0.02em; color: var(--tx); margin: 0; }
  .bsub { font-size: 12.5px; color: var(--mut); margin: 4px 0 0; }

  .cols { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 16px; align-items: start; }
  @media (max-width: 1180px) {
    .cols { grid-template-columns: minmax(0, 1fr); }
  }
  .main { min-width: 0; display: flex; flex-direction: column; gap: 14px; }

  /* Fixed 4 columns — see the comment in the markup. */
  .stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
  @media (max-width: 900px) { .stats { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  .stat {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    text-align: left;
    gap: 0;
    padding: 14px 15px;
    border-radius: var(--r-surface);
    background: var(--s1);
    min-width: 0;
  }
  .stat:not(:disabled):hover { background: var(--s2); }
  .stat.warn { box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--warn) 30%, transparent); }
  .s-k { font-size: 11px; font-weight: 700; color: var(--mut); margin-bottom: 6px; }
  .stat .big { font-size: 27px; line-height: 1; color: var(--tx); }
  .s-u { font-size: 11.5px; color: var(--tx2); margin-top: 6px; }
  .s-n { font-size: 11.5px; color: var(--mut); margin-top: 3px; }
  .s-n.warn { color: var(--warn); }

  .list { background: var(--s1); border-radius: var(--r-surface); padding: 14px 15px; }
  .list h2 { font-size: 13px; font-weight: 700; color: var(--tx); margin: 0 0 10px; }
  .row {
    display: flex;
    align-items: center;
    gap: 11px;
    width: 100%;
    padding: 10px 0;
    border-bottom: 1px solid var(--line);
    text-align: left;
    background: none;
  }
  .row:last-child { border-bottom: 0; }
  /* A 2px rule, not a filled chip: the tint identifies the domain without
     turning the list into a colour chart. */
  .r-bar { width: 2px; align-self: stretch; border-radius: 1px; background: var(--line); flex: none; }
  .r-body { flex: 1; min-width: 0; }
  .r-k { display: block; font-size: 13px; font-weight: 700; color: var(--tx); }
  .r-s { display: block; font-size: 11.5px; color: var(--mut); margin-top: 2px; }
  .r-v { flex: none; font-size: 13px; font-weight: 700; color: var(--tx2); font-variant-numeric: tabular-nums; }
  .row.warn .r-v { color: var(--warn); }

  .note { background: var(--s1); border-radius: var(--r-surface); padding: 15px 16px; }
  .n-body { font-size: 13px; color: var(--tx2); line-height: 1.55; margin: 0; text-wrap: pretty; }
  .n-folded { font-size: 11.5px; color: var(--mut); line-height: 1.5; margin: 11px 0 0; text-wrap: pretty; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
  .chip {
    padding: 5px 10px;
    border-radius: var(--r-pill);
    background: var(--fill);
    color: var(--tx2);
    font-size: 11.5px;
    font-weight: 700;
  }
  .chip:hover { background: var(--fill-strong); color: var(--tx); }
</style>
