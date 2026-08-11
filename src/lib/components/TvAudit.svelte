<script lang="ts">
  // The TV audit. Design answer §D.4.
  //
  // A CARD, NOT A VIEW: one question a parent actually asks — "how much, and was
  // it what we thought?" — this week against last, because a week is the unit a
  // household manages and the comparison is the only number with meaning.
  //
  // THERE IS CURRENTLY NO DATA SOURCE. The design assumed Plex and AndroidTV
  // history; this house has neither integration, and no watch-time tracking
  // anywhere in the config — only `media_player.living_room_tv_*`, which reports
  // what is playing now and keeps no history.
  //
  // An earlier version of this card shipped with invented figures (9.3 hours,
  // "Bluey, Lego Masters, rugby"). That is the worst possible failure for this
  // particular card, because its entire job is to make a surprise arrive BEFORE
  // somebody has a feeling about it — and a fabricated number manufactures the
  // feeling. So it now says what it needs, and shows nothing until it has it.
  import Empty from "./Empty.svelte";
  import { num as afNum, type Lang } from "../lang";

  export type TvWeek = {
    total: number | null;
    delta: number | null;
    people: { name: string; hours: number; titles: string[] }[];
  };

  let {
    week = null,
    lang = "af",
    onopen,
  }: { week?: TvWeek | null; lang?: Lang; onopen?: () => void } = $props();

  const hasData = $derived(!!week && week.total != null && week.people.length > 0);
</script>

{#if hasData && week}
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
        <!-- Neutral, never amber: this is a record, and amber would make it a
             judgement. -->
        <span class="titles">
          {#if week.delta != null}
            {week.delta >= 0 ? "+" : "−"}{afNum(Math.abs(week.delta), lang, 1)} u op verlede week
          {/if}
        </span>
      </div>
    </div>
  </button>
{:else}
  <div class="tv static">
    <p class="kicker">Op die TV · hierdie week</p>
    <Empty
      what="Nog geen kyk-geskiedenis nie"
      how="Dit sal wys hoeveel elkeen gekyk het, hierdie week teenoor verlede week. Dit het 'n bron nodig — Plex of AndroidTV se geskiedenis is nie in Home Assistant nie, en media_player hou nie geskiedenis nie."
    />
  </div>
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
  .tv:not(.static):hover { background: var(--s2); }
  .tv.static { cursor: default; }
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
