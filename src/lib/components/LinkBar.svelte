<script lang="ts">
  // Connection bar + queue review — Phase 1.1 / 2.2.
  //
  // ONE bar, app-level. The brief is emphatic: disconnection is not a per-entity
  // condition, so it must not become 179 stale badges. It also states the frame
  // plainly — "the house as it was at 19:04" — because the danger of a dropped
  // socket isn't the drop, it's continuing to read the last snapshot as though
  // it were current.
  //
  // Amber, not red: this is "attention", and the glyph plus the words carry it
  // independently of hue.
  import { ha } from "../store.svelte";
  import { queue } from "../queue.svelte";

  const at = $derived(
    ha.lastFrameAt
      ? new Date(ha.lastFrameAt).toLocaleTimeString("en-ZA", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })
      : null,
  );
</script>

{#if ha.link === "offline"}
  <div class="bar" role="status" aria-live="polite">
    <span class="ic" aria-hidden="true">⚠️</span>
    <span class="txt">
      Can't reach the house{#if at} — showing it as it was at {at}{/if}
    </span>
    {#if queue.count}
      <span class="qc">{queue.count} queued</span>
    {/if}
  </div>
{/if}

{#if queue.reviewing && ha.link === "live"}
  <div class="bar review" role="status">
    <span class="ic" aria-hidden="true">↩︎</span>
    <span class="txt">
      Back online. {queue.count === 1 ? "1 action was" : `${queue.count} actions were`}
      queued while offline — send {queue.count === 1 ? "it" : "them"}?
    </span>
    <button class="ghost" onclick={() => queue.clear()}>Discard all</button>
  </div>

  <div class="qlist">
    {#each queue.items as it (it.id)}
      <div class="qrow">
        <span class="qlabel">{it.label}</span>
        <button class="send" onclick={() => queue.runOne(it.id)}>Send</button>
        <button class="ghost sm" onclick={() => queue.drop(it.id)}>Skip</button>
      </div>
    {/each}
  </div>
{/if}

<style>
  .bar {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0 20px 12px;
    padding: 9px 14px;
    border-radius: var(--r-ctl);
    background: var(--s1);
    box-shadow: inset 0 0 0 1px var(--line);
    border-left: 2px solid var(--warn);
    font-size: 12.5px;
    color: var(--tx2);
  }
  .bar.review { border-left-color: var(--acc); }
  .ic { flex: none; font-size: 13px; }
  .txt { flex: 1; min-width: 0; }
  .qc {
    flex: none;
    font-family: inherit;
    font-size: 11px;
    font-weight: 700;
    color: var(--warn);
    font-variant-numeric: tabular-nums;
  }

  .qlist { margin: 0 20px 12px; display: flex; flex-direction: column; gap: 6px; }
  .qrow {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 8px 12px;
    border-radius: var(--r-ctl);
    background: var(--s1);
    box-shadow: inset 0 0 0 1px var(--line);
  }
  .qlabel { flex: 1; min-width: 0; font-size: 12.5px; color: var(--tx); }
  .send {
    flex: none;
    padding: 5px 12px;
    border-radius: var(--r-ctl);
    background: var(--grad);
    color: #1b1206;
    font-size: 11.5px;
    font-weight: 800;
  }
  .ghost {
    flex: none;
    padding: 5px 11px;
    border-radius: var(--r-ctl);
    background: var(--fill);
    color: var(--mut);
    font-size: 11.5px;
    font-weight: 700;
  }
  .ghost:hover { background: var(--fill-strong); color: var(--tx2); }
  .ghost.sm { padding: 5px 9px; }
</style>
