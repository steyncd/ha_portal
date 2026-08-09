<script lang="ts">
  // Time machine scrubber — a bar pinned to the bottom that rewinds the entire
  // dashboard. Every view follows automatically, because HAStore's readers
  // answer from the snapshot while this is active.
  import { ha } from "../store.svelte";
  import { timeMachine, TM_IDS } from "../timeMachine.svelte";
  import { toast } from "../toast.svelte";
  const STEPS = [
    { label: "6h", h: 6 },
    { label: "24h", h: 24 },
    { label: "7d", h: 24 * 7 },
  ];

  let pending: ReturnType<typeof setTimeout> | undefined;

  function scrub(e: Event) {
    const frac = Number((e.target as HTMLInputElement).value) / 1000;
    const from = timeMachine.from;
    const at = Math.round(from + frac * (Date.now() - from));
    timeMachine.at = at;
    // Debounce — dragging fires continuously and each load is a history query.
    clearTimeout(pending);
    pending = setTimeout(() => ha.timeTravel(at, TM_IDS), 220);
  }

  function setWindow(h: number) {
    timeMachine.windowH = h;
    const at = Math.max(timeMachine.at, Date.now() - h * 3_600_000);
    ha.timeTravel(at, TM_IDS);
  }

  function exit() {
    timeMachine.reset();
    toast.show("Back to live");
  }
</script>

{#if timeMachine.active}
  <div class="tm" role="region" aria-label="Viewing historical state">
    <div class="row">
      <span class="badge" class:err={!!timeMachine.error}>
        {#if timeMachine.loading}⏳{:else if timeMachine.error}⚠️{:else}🕰️{/if}
        {timeMachine.error ? "History unavailable" : timeMachine.label}
      </span>
      <div class="steps">
        {#each STEPS as s (s.h)}
          <button class="step" class:on={timeMachine.windowH === s.h} onclick={() => setWindow(s.h)}>{s.label}</button>
        {/each}
      </div>
      <button class="live" onclick={exit}>Back to live</button>
    </div>
    <input
      class="slider"
      type="range"
      min="0"
      max="1000"
      value={Math.round(timeMachine.pos * 1000)}
      oninput={scrub}
      aria-label="Scrub through time"
    />
    <div class="ends">
      <span>{timeMachine.windowH >= 24 ? `${Math.round(timeMachine.windowH / 24)}d ago` : `${timeMachine.windowH}h ago`}</span>
      <span class="warn">Controls disabled while viewing the past</span>
      <span>now</span>
    </div>
  </div>
{/if}

<style>
  .tm {
    position: fixed;
    left: 0; right: 0;
    bottom: 0;
    z-index: 40;
    padding: 10px 16px calc(10px + env(safe-area-inset-bottom));
    background: rgba(10, 15, 22, 0.97);
    backdrop-filter: blur(18px);
    border-top: 1px solid color-mix(in srgb, var(--acc) 40%, transparent);
    box-shadow: 0 -12px 40px -18px rgba(0, 0, 0, 0.8);
    animation: tmup 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  @keyframes tmup { from { transform: translateY(100%); } }
  @media (max-width: 820px) { .tm { bottom: calc(60px + env(safe-area-inset-bottom)); } }

  .row { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
  .badge {
    display: inline-flex; align-items: center; gap: 7px;
    font-size: 12.5px; font-weight: 700; color: var(--acc);
    background: color-mix(in srgb, var(--acc) 14%, transparent);
    padding: 5px 11px; border-radius: 999px; white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  .badge.err { color: var(--warning); background: color-mix(in srgb, var(--warning) 14%, transparent); }
  .steps { display: flex; gap: 4px; margin-left: auto; }
  .step {
    font-size: 11px; font-weight: 700; padding: 5px 10px; border-radius: 8px;
    background: rgba(255,255,255,0.06); color: var(--muted);
  }
  .step:hover { background: rgba(255,255,255,0.12); color: var(--text); }
  .step.on { background: var(--soft); color: var(--acc); box-shadow: inset 0 0 0 1px var(--line); }
  .live {
    font-size: 11.5px; font-weight: 800; padding: 6px 13px; border-radius: 9px;
    background: var(--grad); color: #06121b; white-space: nowrap;
  }

  .slider { width: 100%; accent-color: var(--acc); height: 22px; cursor: ew-resize; }
  .ends {
    display: flex; justify-content: space-between; align-items: center;
    font-size: 10px; color: var(--muted-2); margin-top: -2px;
  }
  .ends .warn { color: var(--warning); font-weight: 600; }
  @media (max-width: 560px) { .ends .warn { display: none; } }
</style>
