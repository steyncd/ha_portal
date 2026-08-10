<script lang="ts">
  // Empty state — Phase 1.3.
  //
  // The rule from the brief: an empty state must say WHAT WOULD APPEAR here and
  // HOW TO MAKE IT APPEAR. "No data" tells the reader nothing and leaves them
  // unsure whether the app is broken or they simply haven't done the thing yet.
  import type { Snippet } from "svelte";

  let {
    what,
    how = "",
    icon = "",
    action,
  }: {
    /** What would be here. "Your prayer list", "Parcels in transit". */
    what: string;
    /** How to make it appear. Written as an instruction, not a shrug. */
    how?: string;
    icon?: string;
    /** Optional button/link that performs the how. */
    action?: Snippet;
  } = $props();
</script>

<div class="empty">
  {#if icon}<div class="ic" aria-hidden="true">{icon}</div>{/if}
  <div class="what">{what} will show here</div>
  {#if how}<p class="how">{how}</p>{/if}
  {#if action}<div class="act">{@render action()}</div>{/if}
</div>

<style>
  .empty {
    padding: 30px 20px;
    text-align: center;
    border-radius: var(--r-card);
    background: var(--s1);
    box-shadow: inset 0 0 0 1px var(--line);
  }
  .ic { font-size: 26px; margin-bottom: 8px; opacity: 0.8; }
  .what { font-size: 13.5px; font-weight: 700; color: var(--tx); }
  .how {
    margin: 6px auto 0;
    max-width: 44ch;
    font-size: 12px;
    line-height: 1.55;
    color: var(--mut);
  }
  .act { margin-top: 14px; }
</style>
