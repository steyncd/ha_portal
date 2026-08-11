<script lang="ts">
  // Failure state — Phase 1.3.
  //
  // Names WHAT failed and offers retry. "Something went wrong" is unactionable;
  // "Couldn't reach Trello" tells you whether to retry, check the network, or
  // ignore it because you don't care about Trello right now.
  //
  // Uses amber, not red — same reason as everywhere else in v2: the blue↔amber
  // axis is the colour-blind-safe one, and a failed fetch is "attention", not
  // catastrophe. The glyph and the label carry it regardless of hue.

  let {
    what,
    detail = "",
    onretry,
    retrying = false,
  }: {
    /** What failed, in the user's terms. "Couldn't reach Trello". */
    what: string;
    /** Optional technical detail — an error message, kept short. */
    detail?: string;
    onretry?: () => void;
    retrying?: boolean;
  } = $props();
</script>

<div class="failed" role="alert">
  <span class="ic" aria-hidden="true">⚠️</span>
  <div class="txt">
    <div class="what">{what}</div>
    {#if detail}<div class="detail">{detail}</div>{/if}
  </div>
  {#if onretry}
    <button class="retry" onclick={onretry} disabled={retrying}>
      {retrying ? "Retrying…" : "Retry"}
    </button>
  {/if}
</div>

<style>
  .failed {
    display: flex;
    align-items: flex-start;
    gap: 11px;
    padding: 13px 15px;
    border-radius: var(--r-card);
    background: var(--s1);
    /* Hairline + left rule rather than a tinted fill — surfaces stay neutral. */
    box-shadow: inset 0 0 0 1px var(--line);
    border-left: 2px solid var(--warn);
  }
  .ic { font-size: 15px; line-height: 1.3; flex: none; }
  .txt { flex: 1; min-width: 0; }
  .what { font-size: 13px; font-weight: 700; color: var(--tx); }
  .detail {
    font-size: 11.5px;
    color: var(--mut);
    margin-top: 3px;
    /* Keep a long stack trace from blowing the layout out. */
    overflow-wrap: anywhere;
  }
  .retry {
    flex: none;
    padding: 6px 13px;
    border-radius: var(--r-ctl);
    background: var(--fill-strong);
    color: var(--tx);
    font-size: 12px;
    font-weight: 700;
  }
  .retry:hover:not(:disabled) { background: var(--card-hover); }
  .retry:disabled { opacity: 0.6; cursor: default; }
</style>
