<script lang="ts">
  // Usage analytics — "what do we actually use?"
  //
  // Ranks the household's own portal activity: quick-action taps and page opens.
  // Deliberately measures TAPS, not Home Assistant entity changes: HA state
  // history is dominated by automations (the pumps top it purely from solar and
  // borehole scheduling), so it can't tell you what a *person* reaches for. This
  // can. Ranking is frecency (recency-weighted frequency, 30-day half-life) —
  // the same score that drives "Suggested for now" on the Home surface.
  import { actionLog } from "../lib/actionLog.svelte";
  import { actionById } from "../lib/suggest";
  import { NAV } from "../lib/nav";
  import { prefs } from "../lib/prefs.svelte";
  import { toast } from "../lib/toast.svelte";
  import Icon from "../lib/components/Icon.svelte";
  import { BUCKET_LABEL, bucketFor, type Bucket } from "../lib/actionLog.svelte";

  let { onnav }: { onnav: (id: string) => void } = $props();

  const actions = $derived.by(() => { void actionLog.events; return actionLog.rank("a"); });
  const views = $derived.by(() => { void actionLog.events; return actionLog.rank("v"); });
  const since = $derived.by(() => { void actionLog.events; return actionLog.since; });

  const actionMax = $derived(actions[0]?.score ?? 1);
  const viewMax = $derived(views[0]?.score ?? 1);

  const label = (id: string) => actionById(id)?.label ?? id;
  const icon = (id: string) => actionById(id)?.icon ?? "•";
  const viewName = (id: string) => NAV.find((v) => v.id === id)?.name ?? id;
  const viewIcon = (id: string) => NAV.find((v) => v.id === id)?.ic ?? "layout";

  function ago(ts: number): string {
    const m = Math.round((Date.now() - ts) / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.round(h / 24)}d ago`;
  }
  const dateStr = (ts: number) => new Date(ts).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });

  // When during the day each thing happens — the same buckets the suggester uses.
  const BUCKETS: Bucket[] = ["night", "morning", "midday", "afternoon", "evening", "late"];
  const byBucket = $derived.by(() => {
    void actionLog.events;
    const counts: Record<string, number> = {};
    for (const b of BUCKETS) counts[b] = 0;
    for (const e of actionLog.events) if ((e.k ?? "a") === "a") counts[e.b] = (counts[e.b] ?? 0) + 1;
    return counts;
  });
  const bucketMax = $derived(Math.max(1, ...BUCKETS.map((b) => byBucket[b] ?? 0)));
  const nowBucket = bucketFor();

  function pin(id: string) {
    if (!prefs.favourites.includes(id)) {
      prefs.favourites = [...prefs.favourites, id];
      prefs.save();
      toast.show("Pinned to favourites");
    }
  }
  function unhide(id: string) {
    prefs.hiddenSuggestions = prefs.hiddenSuggestions.filter((x) => x !== id);
    prefs.save();
    toast.show("Will suggest this again");
  }

  let confirming = $state(false);
  function wipe() {
    actionLog.clear();
    confirming = false;
    toast.show("Usage history cleared");
  }
</script>

<div class="head">
  <div>
    <h1>Usage</h1>
    <p>
      What this household actually reaches for.
      {#if since}Tracking since {dateStr(since)} · {actionLog.events.length} events.{:else}Nothing recorded yet.{/if}
    </p>
  </div>
  <button class="wipe" onclick={() => (confirming = !confirming)}>{confirming ? "Cancel" : "Clear history"}</button>
</div>

{#if confirming}
  <div class="confirm">
    <span>Delete all recorded usage? Suggestions will reset to defaults.</span>
    <button onclick={wipe}>Delete</button>
  </div>
{/if}

{#if !actions.length && !views.length}
  <div class="empty">
    <div class="eic">📊</div>
    <strong>No usage recorded yet</strong>
    <p>Tap a few actions on the Home page and open a couple of views — this page will start showing what you use most, and the Home suggestions will adapt to it.</p>
    <button class="go" onclick={() => onnav("home")}>Go to Home →</button>
  </div>
{:else}
  <div class="cols">
    <!-- Most-used actions -->
    <section class="card">
      <div class="ch"><span class="ct">Most-used actions</span><span class="cs">by frecency</span></div>
      {#if actions.length}
        <div class="rows">
          {#each actions as a (a.id)}
            <div class="row">
              <span class="ric">{icon(a.id)}</span>
              <div class="rbody">
                <div class="rtop">
                  <span class="rname">{label(a.id)}</span>
                  <span class="rcount">{a.count}×</span>
                </div>
                <div class="bar"><div class="fill" style="width:{Math.max(4, (a.score / actionMax) * 100)}%"></div></div>
                <div class="rsub">last {ago(a.last)}</div>
              </div>
              {#if prefs.hiddenSuggestions.includes(a.id)}
                <button class="pin" onclick={() => unhide(a.id)} title="Currently hidden from suggestions">🚫</button>
              {:else if !prefs.favourites.includes(a.id)}
                <button class="pin" onclick={() => pin(a.id)} title="Pin to favourites">📌</button>
              {:else}
                <span class="pinned" title="Pinned to favourites">★</span>
              {/if}
            </div>
          {/each}
        </div>
      {:else}
        <p class="none">No actions tapped yet.</p>
      {/if}
    </section>

    <!-- Most-visited pages -->
    <section class="card">
      <div class="ch"><span class="ct">Most-visited pages</span><span class="cs">by frecency</span></div>
      {#if views.length}
        <div class="rows">
          {#each views as v (v.id)}
            <button class="row tap" onclick={() => onnav(v.id)}>
              <span class="ric"><Icon name={viewIcon(v.id)} size={17} /></span>
              <div class="rbody">
                <div class="rtop">
                  <span class="rname">{viewName(v.id)}</span>
                  <span class="rcount">{v.count}×</span>
                </div>
                <div class="bar"><div class="fill alt" style="width:{Math.max(4, (v.score / viewMax) * 100)}%"></div></div>
                <div class="rsub">last {ago(v.last)}</div>
              </div>
              <span class="chev">→</span>
            </button>
          {/each}
        </div>
      {:else}
        <p class="none">No page visits recorded yet.</p>
      {/if}
    </section>
  </div>

  <!-- When we act -->
  <section class="card">
    <div class="ch"><span class="ct">When you act</span><span class="cs">actions by time of day</span></div>
    <div class="buckets">
      {#each BUCKETS as b}
        <div class="bk" class:now={b === nowBucket}>
          <div class="bwrap"><div class="bfill" style="height:{Math.max(3, ((byBucket[b] ?? 0) / bucketMax) * 100)}%"></div></div>
          <span class="bn">{byBucket[b] ?? 0}</span>
          <span class="bl">{BUCKET_LABEL[b].replace(/^(in the |around )/, "")}</span>
        </div>
      {/each}
    </div>
    <p class="foot">Suggestions on the Home page are weighted toward whichever bucket you're in now — so the same tile set changes through the day.</p>
  </section>
{/if}

<style>
  .head { display: flex; align-items: flex-end; justify-content: space-between; gap: 14px; margin-bottom: 18px; flex-wrap: wrap; }
  h1 { margin: 0; font-size: 25px; font-weight: 800; letter-spacing: -0.6px; }
  .head p { margin: 5px 0 0; color: var(--dim); font-size: 13px; }
  .wipe { padding: 8px 13px; border-radius: 10px; background: rgba(255,255,255,0.05); font-size: 12px; font-weight: 600; color: var(--muted); }
  .wipe:hover { background: rgba(255,255,255,0.09); color: var(--text-2); }
  .confirm { display: flex; align-items: center; gap: 14px; padding: 12px 16px; margin-bottom: 16px; border-radius: 13px; font-size: 12.5px; color: var(--text-2); background: color-mix(in srgb, var(--error) 12%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--error) 34%, transparent); }
  .confirm button { margin-left: auto; padding: 7px 15px; border-radius: 9px; background: var(--error); color: #fff; font-size: 12px; font-weight: 700; }

  .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px; }
  @media (max-width: 860px) { .cols { grid-template-columns: 1fr; } }
  .card { padding: 18px; border-radius: 16px; background: rgba(255,255,255,0.03); box-shadow: inset 0 0 0 1px var(--line); margin-bottom: 14px; }
  .ch { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 14px; }
  .ct { font-size: 11px; font-weight: 700; letter-spacing: 0.09em; text-transform: uppercase; color: var(--muted); }
  .cs { font-size: 11px; color: var(--muted-2); font-style: italic; }

  .rows { display: flex; flex-direction: column; gap: 12px; }
  .row { display: flex; align-items: center; gap: 12px; width: 100%; text-align: left; }
  .row.tap { padding: 4px; margin: -4px; border-radius: 11px; }
  .row.tap:hover { background: rgba(255,255,255,0.05); }
  .ric { width: 30px; height: 30px; flex-shrink: 0; border-radius: 9px; display: grid; place-items: center; font-size: 15px; background: rgba(255,255,255,0.06); color: var(--acc); }
  .rbody { flex: 1; min-width: 0; }
  .rtop { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
  .rname { font-size: 12.5px; font-weight: 650; color: var(--text); }
  .rcount { font-size: 11px; font-weight: 700; color: var(--acc); font-variant-numeric: tabular-nums; }
  .bar { height: 6px; border-radius: 3px; background: rgba(255,255,255,0.06); overflow: hidden; margin: 5px 0 3px; }
  .fill { height: 100%; border-radius: 3px; background: var(--grad); }
  .fill.alt { background: linear-gradient(90deg, var(--water), var(--acc)); }
  .rsub { font-size: 10.5px; color: var(--muted-2); }
  .pin { width: 26px; height: 26px; flex-shrink: 0; border-radius: 8px; font-size: 13px; opacity: 0.55; }
  .pin:hover { background: rgba(255,255,255,0.1); opacity: 1; }
  .pinned { width: 26px; flex-shrink: 0; text-align: center; color: var(--acc); font-size: 14px; }
  .chev { color: var(--muted-2); font-size: 13px; flex-shrink: 0; }
  .none { font-size: 12.5px; color: var(--muted); }

  .buckets { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; align-items: end; }
  .bk { display: flex; flex-direction: column; align-items: center; gap: 6px; }
  .bwrap { width: 100%; height: 90px; display: flex; align-items: flex-end; border-radius: 9px; background: rgba(255,255,255,0.04); overflow: hidden; }
  .bfill { width: 100%; background: var(--grad); border-radius: 9px 9px 0 0; opacity: 0.75; }
  .bk.now .bfill { opacity: 1; box-shadow: 0 0 16px color-mix(in srgb, var(--acc) 55%, transparent); }
  .bn { font-size: 13px; font-weight: 800; font-variant-numeric: tabular-nums; }
  .bl { font-size: 10px; color: var(--muted); text-align: center; text-transform: capitalize; }
  .bk.now .bl { color: var(--acc); font-weight: 700; }
  .foot { margin: 14px 0 0; font-size: 11.5px; color: var(--muted-2); font-style: italic; }

  .empty { padding: 44px 24px; text-align: center; border-radius: 18px; background: rgba(255,255,255,0.03); box-shadow: inset 0 0 0 1px var(--line); }
  .eic { font-size: 34px; margin-bottom: 10px; }
  .empty strong { display: block; font-size: 15px; margin-bottom: 6px; }
  .empty p { max-width: 440px; margin: 0 auto 16px; font-size: 12.5px; color: var(--dim); line-height: 1.6; }
  .go { padding: 10px 18px; border-radius: 11px; background: var(--grad); color: #06121b; font-size: 12.5px; font-weight: 700; }
</style>
