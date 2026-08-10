<script lang="ts">
  // The settings row — Phase 4.
  //
  // One pattern for every row in all ten sections: label, explanation, value
  // pill. The explanation is not optional. A settings screen where half the rows
  // are self-evident and half are cryptic teaches you to skim, and then you skim
  // past the one that mattered.
  //
  // `warn` rows take amber text, an amber hairline AND a glyph — three channels,
  // because colour alone is not a signal Christo can rely on.
  // `lock` marks a guard that is not a preference: it renders the value as text
  // with a padlock rather than as something you could click, because "you cannot
  // change this" is more useful than a disabled control that looks broken.
  import type { Snippet } from "svelte";

  let {
    label,
    explain = "",
    value = "",
    warn = false,
    lock = false,
    accent = false,
    onclick,
    control,
  }: {
    label: string;
    explain?: string;
    value?: string;
    warn?: boolean;
    lock?: boolean;
    /** Primary action — takes the copper fill. */
    accent?: boolean;
    onclick?: () => void;
    /** Replaces the value pill with a real control (stepper, toggle). */
    control?: Snippet;
  } = $props();

  const interactive = $derived(!!onclick && !lock);
</script>

<svelte:element
  this={interactive ? "button" : "div"}
  class="row"
  class:warn
  class:interactive
  role={interactive ? "button" : undefined}
  onclick={interactive ? onclick : undefined}
>
  <span class="body">
    <span class="k">
      {#if warn}<span class="glyph" aria-hidden="true">⚠</span>{/if}{label}
    </span>
    {#if explain}<span class="s">{explain}</span>{/if}
  </span>

  {#if control}
    <span class="ctl">{@render control()}</span>
  {:else if value}
    <span class="v" class:accent class:lock>
      {#if lock}<span class="lockglyph" aria-hidden="true">🔒</span>{/if}{value}
    </span>
  {/if}
</svelte:element>

<style>
  .row {
    display: flex;
    align-items: center;
    gap: 14px;
    width: 100%;
    padding: 12px 0;
    border-bottom: 1px solid var(--line);
    text-align: left;
    background: none;
    min-height: 44px;
  }
  .row:last-child { border-bottom: 0; }
  .interactive:hover { background: var(--fill); }
  /* Amber text + amber left rule + a glyph. Three channels, deliberately. */
  .row.warn { box-shadow: inset 2px 0 0 var(--warn); padding-left: 10px; }
  .row.warn .k { color: var(--warn); }
  .glyph { margin-right: 6px; font-size: 11px; }

  .body { flex: 1; min-width: 0; }
  .k { display: block; font-size: 13.5px; font-weight: 700; color: var(--tx); }
  .s { display: block; font-size: 11.5px; color: var(--mut); margin-top: 2px; line-height: 1.45; text-wrap: pretty; }

  .v {
    flex: none;
    padding: 5px 11px;
    border-radius: var(--r-pill);
    background: var(--fill);
    color: var(--tx2);
    font-size: 12px;
    font-weight: 700;
    white-space: nowrap;
  }
  .v.accent { background: var(--acc); color: var(--acc-ink); }
  .v.lock { background: none; color: var(--mut); padding-right: 0; }
  .lockglyph { margin-right: 5px; font-size: 10px; }
  .ctl { flex: none; }
</style>
