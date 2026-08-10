<script lang="ts">
  // The kids' shells. Design answer §D.1, §D.2 — over the REAL engine.
  //
  // An earlier version of this screen carried its own hard-coded chores and a
  // hard-coded R48,50 balance. That was wrong twice over: it broke the project's
  // first ground rule (a wrong number is worse than no number) and it did so with
  // a child's money, on the screen that child opens. src/lib/kids.ts has been the
  // Firestore-backed truth all along — live balances, real chores, and a payout
  // path that posts into the finance project. This reads that.
  //
  // The only thing added on top is TRUST, which the engine has no concept of: how
  // much the house currently trusts a child to say "done" without proof. The rule
  // is that the reward for reliability is BEING ASKED LESS.
  //
  // Liam (11) sees the machinery — level, countdown, trust meter, money that moves
  // the moment it is real. Eben (8) sees none of it: tap, tick, the count drops.
  // No pending state, no timer, no money. Approval still happens in the parent's
  // 21:00 digest, but it is invisible to him, because an eight-year-old cannot act
  // on "your chore was rejected 14 hours ago".
  import { onMount } from "svelte";
  import {
    KIDS, CHORES, ROUTINE, watchKid, toggleChore, toggleRoutine, payout,
    choresToday, routineToday, type KidState,
  } from "../lib/kids";
  import { trust, trustCopy, TRUST_TARGET, TIMED_MINUTES } from "../lib/trust.svelte";
  import { authStore } from "../lib/auth.svelte";
  import { money } from "../lib/lang";
  import { toast } from "../lib/toast.svelte";

  let who = $state<"liam" | "eben">("liam");
  const kid = $derived(KIDS.find((k) => k.slug === who)!);

  // Live Firestore state per kid, plus the trust doc.
  let states = $state<Record<string, KidState>>({});
  let tick = $state(0);
  onMount(() => {
    const stops = KIDS.flatMap((k) => [
      watchKid(k.slug, (s) => { states = { ...states, [k.slug]: s }; }),
      trust.watch(k.slug),
    ]);
    // Drives the visible countdown and lets expired timers land.
    const t = setInterval(() => { tick++; landExpired(); }, 20_000);
    return () => { stops.forEach((f) => f()); clearInterval(t); };
  });

  const st = $derived(states[who] ?? {});
  const done = $derived.by(() => { void tick; return choresToday(st); });
  const rdone = $derived.by(() => { void tick; return routineToday(st); });
  const level = $derived.by(() => { void tick; return trust.level(who); });
  const streak = $derived.by(() => { void tick; return trust.streak(who); });
  const copy = $derived(trustCopy(streak));

  // Eben's list is the unpaid family contributions plus his routine; no rand.
  const myChores = $derived(who === "eben" ? CHORES.filter((c) => c.rand === 0) : CHORES);
  const period = $derived(new Date().getHours() < 14 ? "morning" : "evening");
  const myRoutine = $derived(ROUTINE.filter((r) => r.period === period));

  const greeting = () => {
    const h = new Date().getHours();
    return h < 12 ? "Goeiemôre" : h < 18 ? "Goeiemiddag" : "Goeienaand";
  };

  const LEVEL_WORD = { photo: "foto", timed: "timer", self: "op jou woord" } as const;

  /** A timed chore whose window has passed completes silently — a chore that goes
   *  right should notify nobody. */
  async function landExpired() {
    for (const k of KIDS) {
      for (const id of trust.expired(k.slug)) {
        const chore = CHORES.find((c) => c.id === id);
        const ks = states[k.slug] ?? {};
        if (chore && !choresToday(ks).includes(id)) await toggleChore(k.slug, ks, chore);
        await trust.clearTimer(k.slug, id);
        await trust.up(k.slug);
      }
    }
  }

  /** The child taps. What happens next depends only on their standing. */
  async function tap(choreId: string) {
    const chore = CHORES.find((c) => c.id === choreId);
    if (!chore) return;
    if (done.includes(choreId)) { await toggleChore(who, st, chore); return; }

    // Eben and any self-certifying child: done is done.
    if (who === "eben" || level === "self") {
      await toggleChore(who, st, chore);
      await trust.up(who);
      return;
    }
    if (level === "timed") { await trust.startTimer(who, choreId); return; }
    await trust.awaitPhoto(who, choreId);
  }

  const pendingMins = (id: string) => { void tick; return trust.minutesLeft(who, id); };
  const awaitingPhoto = $derived.by(() => { void tick; return trust.state(who).awaitingPhoto ?? []; });

  async function onPayout() {
    const r = await payout(who, st);
    if (r.amount > 0) toast.show(`${money(r.amount, "af")} uitbetaal aan ${kid.name}`);
    else toast.show("Niks om uit te betaal nie");
  }
</script>

<div class="wrap">
  <div class="who" role="tablist">
    {#each KIDS as k (k.slug)}
      <button class="wb" class:on={who === k.slug} role="tab" aria-selected={who === k.slug} onclick={() => (who = k.slug as "liam" | "eben")}>
        {k.name} · {k.age}
      </button>
    {/each}
  </div>

  {#if who === "eben"}
    <!-- ── Eben ──────────────────────────────────────────────────────────── -->
    <h1 class="hi">{greeting()}, {kid.name}</h1>
    {@const left = myChores.filter((c) => !done.includes(c.id)).length}
    <p class="count">
      {left === 0 ? "Alles klaar vandag!" : `Nog ${left} ${left === 1 ? "takie" : "takies"} vandag`}
    </p>

    <div class="big-grid">
      {#each myChores as c (c.id)}
        {@const isDone = done.includes(c.id)}
        <button class="big-tile" class:done={isDone} onclick={() => tap(c.id)}>
          <span class="big-ic">{isDone ? "✓" : c.icon}</span>
          <span class="big-lb">{c.label}</span>
        </button>
      {/each}
    </div>
    {#if left === 0}<p class="well">Lekker gedaan.</p>{/if}
  {:else}
    <!-- ── Liam ──────────────────────────────────────────────────────────── -->
    <h1 class="hi">{greeting()}, {kid.name}</h1>
    <div class="bal">
      <span class="bk">Sakgeld</span>
      <!-- The live Firestore balance. Moves on approval, not on payday. -->
      <span class="bv">{money(st.balance ?? 0, "af")}</span>
      <span class="bs">
        {st.paidTotal != null ? `${money(st.paidTotal, "af")} altesaam verdien` : "betaaldag Vrydag"}
      </span>
      {#if authStore.isOwner && (st.balance ?? 0) > 0}
        <button class="pay" onclick={onPayout}>Betaal uit</button>
      {/if}
    </div>

    <p class="divider">Takies · {LEVEL_WORD[level]}</p>
    <div class="list">
      {#each myChores as c (c.id)}
        {@const isDone = done.includes(c.id)}
        {@const mins = pendingMins(c.id)}
        {@const photo = awaitingPhoto.includes(c.id)}
        <button class="ch" class:done={isDone} class:sent={photo} class:counting={mins != null} onclick={() => tap(c.id)}>
          <span class="ci">{isDone ? "✓" : photo || mins != null ? "⏳" : c.icon}</span>
          <span class="cb">
            <span class="cl">{c.label}</span>
            <span class="cs">
              {#if isDone}
                klaar{#if c.rand > 0} · {money(c.rand, "af")} bygetel{/if}
              {:else if photo}
                foto gestuur · wag vir Pappa
              {:else if mins != null}
                <!-- A NUMBER, not a progress ring: a ring says "wait", a number
                     says "you are done, this is just paperwork" — and he is done.
                     Naming the veto is what makes the timer read as trust. -->
                goedgekeur oor {mins} min · Mamma kan keer
              {:else if level === "photo"}
                stuur 'n foto
              {:else}
                tik as jy klaar is
              {/if}
            </span>
          </span>
          {#if c.rand > 0}<span class="cv">{money(c.rand, "af")}</span>{/if}
        </button>
      {/each}
    </div>

    <p class="divider">{period === "morning" ? "Oggend" : "Aand"}</p>
    <div class="list">
      {#each myRoutine as r (r.id)}
        {@const isDone = rdone.includes(r.id)}
        <button class="ch" class:done={isDone} onclick={() => toggleRoutine(who, st, r.id)}>
          <span class="ci">{isDone ? "✓" : r.icon}</span>
          <span class="cb"><span class="cl">{r.label}</span></span>
        </button>
      {/each}
    </div>

    <!-- Amber ONLY here: the one place in the kids' shell where something has
         actually gone backwards. -->
    <section class="trust" class:warn={copy.tone === "warn"}>
      <p class="tk">Vertroue</p>
      <div class="bar" role="img" aria-label={`${streak} van ${TRUST_TARGET}`}>
        <span class="fill" class:ok={copy.tone === "ok"} class:warn={copy.tone === "warn"} style="width:{(streak / TRUST_TARGET) * 100}%"></span>
      </div>
      <p class="tc">{copy.text}</p>
      <p class="tn">
        {streak} van {TRUST_TARGET}. Op die timer-vlak keur dit self goed na
        {TIMED_MINUTES} minute — die beloning vir betroubaarheid is dat dit minder vra.
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

  .big-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .big-tile {
    min-height: 150px;
    border-radius: var(--r-surface);
    background: var(--s1);
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 12px; padding: 16px;
  }
  .big-tile.done { background: color-mix(in srgb, var(--ok) 16%, var(--s1)); }
  .big-ic { font-size: 40px; line-height: 1; }
  .big-tile.done .big-ic { color: var(--ok); }
  .big-lb { font-size: 15px; font-weight: 700; color: var(--tx); text-align: center; line-height: 1.3; }
  .well { font-size: 16px; font-weight: 700; color: var(--ok); text-align: center; margin: 18px 0 0; }

  .bal { background: var(--s1); border-radius: var(--r-surface); padding: 14px 16px; margin-bottom: 16px; position: relative; }
  .bk { display: block; font-size: 11px; font-weight: 700; color: var(--mut); }
  .bv { display: block; font-size: 27px; font-weight: 800; letter-spacing: -0.03em; color: var(--tx); font-variant-numeric: tabular-nums; margin-top: 4px; }
  .bs { display: block; font-size: 11.5px; color: var(--mut); margin-top: 3px; }
  .pay {
    position: absolute; top: 14px; right: 14px;
    padding: 8px 14px; border-radius: var(--r-control);
    background: var(--acc); color: var(--acc-ink);
    font-size: 12.5px; font-weight: 800; min-height: 40px;
  }

  .divider { margin: 0 2px 8px; }
  .list { display: grid; gap: 7px; margin-bottom: 16px; }
  .ch {
    display: flex; align-items: center; gap: 11px;
    padding: 13px 14px; border-radius: var(--r-surface);
    background: var(--s1); text-align: left; min-height: 44px;
  }
  .ch.done { background: color-mix(in srgb, var(--ok) 12%, var(--s1)); }
  .ci { flex: none; font-size: 17px; width: 24px; text-align: center; }
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
