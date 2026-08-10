<script lang="ts">
  // The parent side of the approval loop. Phase 5.2 / D.1.
  //
  // ONE TAP CLEARS THE DAY. The whole flow exists so that approving is cheaper
  // than not approving — if it took four taps per chore, the parent would stop,
  // and the trust levels would never advance because nothing would ever get
  // approved.
  //
  // The same action exists as a single row in the 21:00 digest. Nothing in this
  // loop ever sends its own push: it rides the digest, which was the argument.
  import { chores, ledger } from "../household.svelte";
  import { money, type Lang } from "../lang";
  import { toast } from "../toast.svelte";

  let { lang = "af" }: { lang?: Lang } = $props();

  const pending = $derived(chores.pending);
  const counting = $derived(chores.counting);
  const outstanding = $derived(
    [...pending, ...counting].reduce((s, c) => s + c.value, 0),
  );

  function approveAll() {
    const r = chores.approveAll();
    if (!r.count) return;
    // Real undo: restores each chore's prior state and reverses the credit,
    // rather than guessing at an inverse.
    toast.showUndo(
      `${r.count} ${r.count === 1 ? "takie" : "takies"} goedgekeur · ${money(r.value, lang)}`,
      r.undo,
    );
  }
</script>

{#if pending.length || counting.length}
  <button class="all" onclick={approveAll}>
    Keur al {pending.length + counting.length} goed · {money(outstanding, lang)}
  </button>
  <p class="note">
    Een tik maak die dag klaar en die kentekens val na nul. Dit is ontdoenbaar.
  </p>

  <div class="list">
    {#each pending as c (c.id)}
      <div class="row">
        <span class="body">
          <span class="k">{c.label}</span>
          <span class="s">foto gestuur · wag vir goedkeuring</span>
        </span>
        <span class="v">{money(c.value, lang)}</span>
        <button class="ok" onclick={() => chores.approve(c.id)}>Keur goed</button>
      </div>
    {/each}

    {#each counting as c (c.id)}
      {@const left = chores.minutesLeft(c)}
      <div class="row">
        <span class="body">
          <span class="k">{c.label}</span>
          <!-- The parent sees the same countdown the child sees. If the two
               disagreed, the veto would feel arbitrary. -->
          <span class="s">keur self goed oor {left} min</span>
        </span>
        <span class="v">{money(c.value, lang)}</span>
        <button class="no" onclick={() => chores.reject(c.id)}>Keer</button>
      </div>
    {/each}
  </div>
{:else}
  <p class="note">
    Niks wag nie. Elke takie wat vandag klaargemaak is, is al goedgekeur —
    'n takie wat reg verloop, laat niemand weet nie.
  </p>
{/if}

<p class="note dim">
  Balanse: {#each ledger.people.filter((p) => p.id !== "eben") as p (p.id)}{p.name}
    {money(p.balance, lang)}{/each} · betaaldag Vrydag
</p>

<style>
  .all {
    width: 100%;
    padding: 13px;
    border-radius: var(--r-control);
    background: var(--acc);
    color: var(--acc-ink);
    font-size: 13.5px;
    font-weight: 800;
    min-height: 44px;
  }
  .note { font-size: 11.5px; color: var(--mut); line-height: 1.5; margin: 9px 0 0; text-wrap: pretty; }
  .note.dim { border-top: 1px solid var(--line); padding-top: 10px; margin-top: 14px; }
  .list { display: grid; gap: 2px; margin-top: 12px; }
  .row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 0;
    border-bottom: 1px solid var(--line);
  }
  .row:last-child { border-bottom: 0; }
  .body { flex: 1; min-width: 0; }
  .k { display: block; font-size: 13px; font-weight: 700; color: var(--tx); }
  .s { display: block; font-size: 11.5px; color: var(--mut); margin-top: 2px; }
  .v { flex: none; font-size: 12.5px; font-weight: 700; color: var(--tx2); font-variant-numeric: tabular-nums; }
  .ok {
    flex: none;
    padding: 7px 12px;
    border-radius: var(--r-control);
    background: var(--fill-strong);
    color: var(--tx);
    font-size: 12px;
    font-weight: 700;
    min-height: 36px;
  }
  .no {
    flex: none;
    padding: 7px 12px;
    border-radius: var(--r-control);
    background: var(--fill);
    color: var(--mut);
    font-size: 12px;
    font-weight: 700;
    min-height: 36px;
  }
</style>
