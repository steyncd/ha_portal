<script lang="ts">
  // Skeleton — Phase 1.3. Never a spinner.
  //
  // A spinner says "something is happening"; a skeleton says "this is what is
  // arriving, and roughly how much of it". On a dashboard that difference
  // matters, because the layout stops jumping when the real content lands.
  //
  // Deliberately no shimmer sweep: it is a large animated gradient repeated
  // across many placeholders, which is exactly the kind of continuous paint
  // the motion budget (rule 4) exists to avoid. A slow opacity pulse on the
  // whole block costs one composited property instead.

  let {
    variant = "lines",
    lines = 3,
    height = 0,
  }: {
    /** `lines` = text block · `metric` = value + label · `card` = a whole card · `tiles` = a grid. */
    variant?: "lines" | "metric" | "card" | "tiles";
    /** Line/tile count for `lines` and `tiles`. */
    lines?: number;
    /** Explicit height in px for `card`. */
    height?: number;
  } = $props();

  const widths = ["92%", "78%", "85%", "64%", "88%", "72%"];
</script>

<div class="sk" aria-busy="true" aria-live="polite">
  <span class="sr">Loading</span>

  {#if variant === "lines"}
    {#each Array(lines) as _, i}
      <div class="bar" style="width:{widths[i % widths.length]}"></div>
    {/each}
  {:else if variant === "metric"}
    <div class="bar big"></div>
    <div class="bar lbl"></div>
  {:else if variant === "tiles"}
    <div class="tiles">
      {#each Array(lines) as _}<div class="tile"></div>{/each}
    </div>
  {:else}
    <div class="card" style={height ? `height:${height}px` : ""}></div>
  {/if}
</div>

<style>
  .sk { animation: pulse 1.6s ease-in-out infinite; }
  .sr {
    position: absolute;
    width: 1px; height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  .bar {
    height: 11px;
    border-radius: var(--r-ctl);
    background: var(--s2);
    margin-bottom: 9px;
  }
  .bar:last-child { margin-bottom: 0; }
  .bar.big { height: 27px; width: 46%; margin-bottom: 10px; }
  .bar.lbl { height: 9px; width: 28%; }
  .card {
    height: 132px;
    border-radius: var(--r-card);
    background: var(--s2);
  }
  .tiles {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
    gap: 9px;
  }
  .tile {
    height: 74px;
    border-radius: var(--r-ctl);
    background: var(--s2);
  }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.55; } }
  :global(.reduce-motion) .sk { animation: none; opacity: 0.75; }
</style>
