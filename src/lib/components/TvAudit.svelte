<script lang="ts">
  // The TV audit. Phase 5.2 / D.4.
  //
  // A CARD, NOT A VIEW — and that is the whole design. It answers one question a
  // parent actually asks: "how much, and was it what we thought?" The window is
  // this week against last week, because a week is the unit a household manages
  // and the comparison is the only number with any meaning.
  //
  // What the reader does with it: nothing, most weeks. That is fine, and it is
  // exactly why it is not a view. It earns its place on the two occasions a year
  // when the number is surprising, and its job is to make that surprise arrive
  // BEFORE somebody has a feeling about it.
  //
  // Explicitly NOT: no playback controls, no recommendations, no per-day chart,
  // no goals or limits. The moment it suggests a limit it becomes a thing to
  // argue with rather than a thing to read.
  import type { TvWeek } from "../household.svelte";
  import { num as afNum, type Lang } from "../lang";

  let {
    week,
    lang = "af",
    onopen,
  }: { week: TvWeek; lang?: Lang; onopen?: () => void } = $props();
</script>

{#if week.total != null}
  <button class="tv" onclick={() => onopen?.()}>
    <p class="kicker">Op die TV · hierdie week</p>
    <div class="rows">
      {#each week.people as p (p.name)}
        <div class="r">
          <span class="who">{p.name}</span>
          <span class="hrs">{afNum(p.hours, lang, 1)} u</span>
          <span class="titles">{p.titles.join(", ")}</span>
        </div>
      {/each}
      <div class="r tot">
        <span class="who">Almal saam</span>
        <span class="hrs">{afNum(week.total, lang, 1)} u</span>
        <!-- The delta is the point. A total on its own is a number; a total
             against last week is information. Neutral, never amber: this is a
             record, and amber would make it a judgement. -->
        <span class="titles">
          {#if week.delta != null}
            {week.delta >= 0 ? "+" : "−"}{afNum(Math.abs(week.delta), lang, 1)} u op verlede week
          {/if}
        </span>
      </div>
    </div>
  </button>
{/if}

<style>
  .tv {
    display: block;
    width: 100%;
    text-align: left;
    background: var(--s1);
    border-radius: var(--r-surface);
    padding: 15px 16px;
    margin-top: 14px;
  }
  .tv:hover { background: var(--s2); }
  .rows { display: grid; gap: 2px; margin-top: 9px; }
  .r {
    display: grid;
    grid-template-columns: 88px 62px minmax(0, 1fr);
    gap: 10px;
    align-items: baseline;
    padding: 7px 0;
    border-bottom: 1px solid var(--line);
  }
  .r:last-child { border-bottom: 0; }
  .who { font-size: 12.5px; font-weight: 700; color: var(--tx); }
  .hrs { font-size: 12.5px; font-weight: 700; color: var(--tx2); font-variant-numeric: tabular-nums; }
  .titles { font-size: 11.5px; color: var(--mut); min-width: 0; }
  .tot .who, .tot .hrs { color: var(--tx); }
  @media (max-width: 560px) {
    .r { grid-template-columns: 1fr auto; }
    .titles { grid-column: 1 / -1; }
  }
</style>
