<script lang="ts">
  // The kids' shells. Phase 5.2 / D.1, D.2.
  //
  // Two children, two different designs, and the difference is the point.
  //
  // LIAM (11) sees the machinery: which level he is on, the countdown, the trust
  // meter, and money that moves the moment it is real. The reward for
  // reliability is BEING ASKED LESS — the meter is not a score, it is a countdown
  // to being left alone.
  //
  // EBEN (8) sees none of it. Tap, tick, the count drops. There is no pending
  // state, no "waiting for Dad", no timer, no money and no streaks. Approval
  // still happens — it appears in the parent's 21:00 digest exactly like Liam's —
  // but it is INVISIBLE to him, because an eight-year-old cannot act on "your
  // chore was rejected 14 hours ago". He can act on his dad telling him.
  import { onMount } from "svelte";
  import { chores, ledger, levelFor, trustCopy, TRUST_TARGET } from "../lib/household.svelte";
  import { money, t } from "../lib/lang";

  let who = $state<"liam" | "eben">("liam");
  const L = "af" as const;

  // Drives the visible countdown and lets expired timers land.
  let tick = $state(0);
  onMount(() => {
    const i = setInterval(() => { chores.tick(); tick++; }, 20_000);
    return () => clearInterval(i);
  });

  const liam = $derived(ledger.person("liam"));
  const mine = $derived.by(() => { void tick; return chores.forWho(who); });
  const left = $derived(mine.filter((c) => c.state !== "done").length);
  const trust = $derived(liam.trust);
  const copy = $derived(trustCopy(trust));
  const level = $derived(levelFor(trust));

  const greeting = () => {
    const h = new Date().getHours();
    return h < 12 ? "Goeiemôre" : h < 18 ? "Goeiemiddag" : "Goeienaand";
  };

  const LEVEL_WORD = { photo: "foto", timed: "timer", self: "op jou woord" } as const;
</script>

<div class="wrap">
  <div class="who" role="tablist">
    <button class="wb" class:on={who === "liam"} role="tab" aria-selected={who === "liam"} onclick={() => (who = "liam")}>Liam · 11</button>
    <button class="wb" class:on={who === "eben"} role="tab" aria-selected={who === "eben"} onclick={() => (who = "eben")}>Eben · 8</button>
  </div>

  {#if who === "eben"}
    <!-- ── Eben ──────────────────────────────────────────────────────────── -->
    <h1 class="hi">{greeting()}, Eben</h1>
    <!-- A small number that reaches zero. Never a percentage, never a streak. -->
    <p class="count">{left === 0 ? "Alles klaar vandag!" : `Nog ${left} ${left === 1 ? "takie" : "takies"} vandag`}</p>

    <div class="big-grid">
      {#each mine as c (c.id)}
        {@const done = c.state === "done"}
        <button class="big-tile" class:done onclick={() => chores.tap(c.id)} disabled={done}>
          <span class="big-ic">{done ? "✓" : "•"}</span>
          <span class="big-lb">{c.label}</span>
        </button>
      {/each}
    </div>
    {#if left === 0}
      <p class="well">Lekker gedaan.</p>
    {/if}
  {:else}
    <!-- ── Liam ──────────────────────────────────────────────────────────── -->
    <h1 class="hi">{greeting()}, Liam</h1>
    <div class="bal">
      <span class="bk">{t("Balance", L)}</span>
      <!-- Moves on approval, not on payday. Money that appears only on Friday is
           not a consequence of today's work. -->
      <span class="bv">{money(liam.balance, L)}</span>
      <span class="bs">betaaldag Vrydag</span>
    </div>

    <p class="divider">{t("Chores", L)} · {LEVEL_WORD[level]}</p>
    <div class="list">
      {#each mine as c (c.id)}
        {@const mins = chores.minutesLeft(c)}
        <button
          class="ch"
          class:sent={c.state === "sent"}
          class:counting={c.state === "counting"}
          class:done={c.state === "done"}
          onclick={() => chores.tap(c.id)}
          disabled={c.state !== "todo"}
        >
          <span class="ci">
            {c.state === "done" ? "✓" : c.state === "sent" ? "⏳" : c.state === "counting" ? "⏳" : "•"}
          </span>
          <span class="cb">
            <span class="cl">{c.label}</span>
            <span class="cs">
              {#if c.state === "done"}
                klaar · {money(c.value, L)} bygetel
              {:else if c.state === "sent"}
                foto gestuur · wag vir Pappa
              {:else if c.state === "counting"}
                <!-- A NUMBER, not a progress ring. A ring says "wait"; a number
                     says "you are done, this is just paperwork" — and he IS done.
                     "Mamma kan keer" is what makes the timer read as trust
                     rather than as nobody watching. -->
                goedgekeur oor {mins} min · Mamma kan keer
              {:else if c.level === "photo"}
                stuur 'n foto
              {:else if c.level === "timed"}
                tik as jy klaar is
              {:else}
                tik as jy klaar is
              {/if}
            </span>
          </span>
          <span class="cv">{money(c.value, L)}</span>
        </button>
      {/each}
    </div>

    <!-- The trust meter. Amber ONLY here, because this is the one place in the
         kids' shell where something has actually gone backwards. -->
    <section class="trust" class:warn={copy.tone === "warn"}>
      <p class="tk">{t("Trust", L)}</p>
      <div class="bar" role="img" aria-label={`${trust} van ${TRUST_TARGET}`}>
        <span
          class="fill"
          class:ok={copy.tone === "ok"}
          class:warn={copy.tone === "warn"}
          style="width:{(trust / TRUST_TARGET) * 100}%"
        ></span>
      </div>
      <p class="tc">{copy.text}</p>
      <p class="tn">
        {trust} van {TRUST_TARGET}. Die belonging vir betroubaarheid is dat dit
        minder vra — nie 'n telling nie.
      </p>
    </section>
  {/if}
</div>

<style>
  .wrap { display: flex; flex-direction: column; max-width: 560px; margin: 0 auto; width: 100%; }
  .who { display: flex; gap: 6px; padding: 4px; border-radius: var(--r-control); background: var(--s1); margin-bottom: 14px; }
  .wb { flex: 1; padding: 9px; border-radius: 8px; font-size: 13px; font-weight: 700; color: var(--mut); background: none; min-height: 44px; }
  .wb.on { background: var(--fill-strong); color: var(--tx); }

  .hi { font-size: 20px; font-weight: 750; letter-spacing: -0.02em; color: var(--tx); margin: 4px 2px 6px; }
  .count { font-size: 14px; font-weight: 700; color: var(--tx2); margin: 0 2px 16px; }

  /* Eben: ~150px targets, one screen, icon-led. */
  .big-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .big-tile {
    min-height: 150px;
    border-radius: var(--r-surface);
    background: var(--s1);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 16px;
  }
  .big-tile.done { background: color-mix(in srgb, var(--ok) 16%, var(--s1)); }
  .big-ic { font-size: 40px; line-height: 1; color: var(--mut); }
  .big-tile.done .big-ic { color: var(--ok); }
  .big-lb { font-size: 15px; font-weight: 700; color: var(--tx); text-align: center; line-height: 1.3; }
  .well { font-size: 16px; font-weight: 700; color: var(--ok); text-align: center; margin: 18px 0 0; }

  /* Liam */
  .bal { background: var(--s1); border-radius: var(--r-surface); padding: 14px 16px; margin-bottom: 16px; }
  .bk { display: block; font-size: 11px; font-weight: 700; color: var(--mut); }
  .bv { display: block; font-size: 27px; font-weight: 800; letter-spacing: -0.03em; color: var(--tx); font-variant-numeric: tabular-nums; margin-top: 4px; }
  .bs { display: block; font-size: 11.5px; color: var(--mut); margin-top: 3px; }

  .divider { margin: 0 2px 8px; }
  .list { display: grid; gap: 7px; margin-bottom: 16px; }
  .ch {
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 13px 14px;
    border-radius: var(--r-surface);
    background: var(--s1);
    text-align: left;
    min-height: 44px;
  }
  .ch.done { background: color-mix(in srgb, var(--ok) 12%, var(--s1)); }
  .ci { flex: none; font-size: 17px; width: 22px; text-align: center; color: var(--mut); }
  .ch.done .ci { color: var(--ok); }
  .ch.sent .ci, .ch.counting .ci { color: var(--acc); }
  .cb { flex: 1; min-width: 0; }
  .cl { display: block; font-size: 14px; font-weight: 700; color: var(--tx); }
  .cs { display: block; font-size: 11.5px; color: var(--mut); margin-top: 2px; }
  .ch.sent .cs, .ch.counting .cs { color: var(--acc); }
  .ch.done .cs { color: var(--ok); }
  .cv { flex: none; font-size: 12.5px; font-weight: 700; color: var(--tx2); font-variant-numeric: tabular-nums; }

  .trust { background: var(--s1); border-radius: var(--r-surface); padding: 15px 16px; }
  .trust.warn { box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--warn) 34%, transparent); }
  .tk { font-size: 11px; font-weight: 700; color: var(--mut); margin: 0 0 9px; }
  .bar { height: 6px; border-radius: 3px; background: var(--fill); overflow: hidden; }
  .fill { display: block; height: 100%; background: var(--acc); transition: width 0.22s; }
  .fill.ok { background: var(--ok); }
  .fill.warn { background: var(--warn); }
  :global(.reduce-motion) .fill { transition: none; }
  .tc { font-size: 13.5px; font-weight: 700; color: var(--tx); margin: 10px 0 0; line-height: 1.4; text-wrap: pretty; }
  .trust.warn .tc { color: var(--warn); }
  .tn { font-size: 11.5px; color: var(--mut); margin: 6px 0 0; line-height: 1.5; text-wrap: pretty; }
</style>
