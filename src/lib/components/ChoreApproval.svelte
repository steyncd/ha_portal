<script lang="ts">
  // The parent side of the approval loop. Design answer §D.1.
  //
  // ONE TAP CLEARS THE DAY. The whole flow exists so that approving is cheaper
  // than not approving — if it took four taps per chore the parent would stop, and
  // the trust levels would never advance because nothing would ever get approved.
  //
  // Reads the REAL engine: src/lib/kids.ts for chores and balances (Firestore),
  // src/lib/trust.svelte.ts for what is awaiting a photo or counting down. An
  // earlier version of this component carried its own invented ledger.
  //
  // The same action exists as one row in the 21:00 digest. Nothing in this loop
  // ever sends its own push — it rides the digest, which was the argument.
  import { onMount } from "svelte";
  import { KIDS, CHORES, watchKid, toggleChore, choresToday, type KidState } from "../kids";
  import { trust, TIMED_MINUTES } from "../trust.svelte";
  import { money, type Lang } from "../lang";
  import { toast } from "../toast.svelte";
  import Empty from "./Empty.svelte";

  let { lang = "af" }: { lang?: Lang } = $props();

  let states = $state<Record<string, KidState>>({});
  let tick = $state(0);
  onMount(() => {
    const stops = KIDS.flatMap((k) => [
      watchKid(k.slug, (s) => { states = { ...states, [k.slug]: s }; }),
      trust.watch(k.slug),
    ]);
    const t = setInterval(() => tick++, 20_000);
    return () => { stops.forEach((f) => f()); clearInterval(t); };
  });

  type Waiting = { slug: string; name: string; chore: (typeof CHORES)[number]; kind: "photo" | "timer"; mins: number | null };

  const waiting = $derived.by<Waiting[]>(() => {
    void tick;
    const out: Waiting[] = [];
    for (const k of KIDS) {
      const t = trust.state(k.slug);
      for (const id of t.awaitingPhoto ?? []) {
        const chore = CHORES.find((c) => c.id === id);
        if (chore) out.push({ slug: k.slug, name: k.name, chore, kind: "photo", mins: null });
      }
      for (const id of Object.keys(t.pending ?? {})) {
        const chore = CHORES.find((c) => c.id === id);
        if (chore) out.push({ slug: k.slug, name: k.name, chore, kind: "timer", mins: trust.minutesLeft(k.slug, id) });
      }
    }
    return out;
  });

  const outstanding = $derived(waiting.reduce((s, w) => s + w.chore.rand, 0));

  async function approve(w: Waiting) {
    const s = states[w.slug] ?? {};
    if (!choresToday(s).includes(w.chore.id)) await toggleChore(w.slug, s, w.chore);
    if (w.kind === "photo") await trust.clearPhoto(w.slug, w.chore.id);
    else await trust.clearTimer(w.slug, w.chore.id);
    await trust.up(w.slug);
  }

  async function reject(w: Waiting) {
    if (w.kind === "photo") await trust.clearPhoto(w.slug, w.chore.id);
    else await trust.clearTimer(w.slug, w.chore.id);
    // One level down, never to zero — see trust.down().
    await trust.down(w.slug);
    toast.show(`${w.chore.label} teruggestuur`);
  }

  async function approveAll() {
    const list = [...waiting];
    if (!list.length) return;
    for (const w of list) await approve(w);
    // Real undo: reverses each credit and each trust step, rather than guessing.
    toast.showUndo(
      `${list.length} ${list.length === 1 ? "takie" : "takies"} goedgekeur · ${money(outstanding, lang)}`,
      async () => {
        for (const w of list) {
          const s = states[w.slug] ?? {};
          if (choresToday(s).includes(w.chore.id)) await toggleChore(w.slug, s, w.chore);
          await trust.down(w.slug);
          if (w.kind === "photo") await trust.awaitPhoto(w.slug, w.chore.id);
          else await trust.startTimer(w.slug, w.chore.id);
        }
      },
    );
  }
</script>

{#if waiting.length}
  <button class="all" onclick={approveAll}>
    Keur al {waiting.length} goed{#if outstanding > 0} · {money(outstanding, lang)}{/if}
  </button>
  <p class="note">Een tik maak die dag klaar en die kentekens val na nul. Dit is ontdoenbaar.</p>

  <div class="list">
    {#each waiting as w (w.slug + w.chore.id)}
      <div class="row">
        <span class="body">
          <span class="k">{w.name} · {w.chore.label}</span>
          <span class="s">
            {#if w.kind === "photo"}
              foto gestuur · wag vir goedkeuring
            {:else}
              keur self goed oor {w.mins} min
            {/if}
          </span>
        </span>
        {#if w.chore.rand > 0}<span class="v">{money(w.chore.rand, lang)}</span>{/if}
        <button class="ok" onclick={() => approve(w)}>Keur goed</button>
        <button class="no" onclick={() => reject(w)}>Keer</button>
      </div>
    {/each}
  </div>
{:else}
  <Empty
    what="Niks wag nie"
    how="Elke takie wat vandag klaargemaak is, is al goedgekeur — 'n takie wat reg verloop, laat niemand weet nie. Takies op die timer-vlak keur self goed na {TIMED_MINUTES} minute."
  />
{/if}

<p class="note dim">
  {#each KIDS as k (k.slug)}{k.name} {money(states[k.slug]?.balance ?? 0, lang)}{#if k.slug !== KIDS[KIDS.length - 1].slug} · {/if}{/each}
  · betaaldag Vrydag
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
  .row { display: flex; align-items: center; gap: 9px; padding: 10px 0; border-bottom: 1px solid var(--line); }
  .row:last-child { border-bottom: 0; }
  .body { flex: 1; min-width: 0; }
  .k { display: block; font-size: 13px; font-weight: 700; color: var(--tx); }
  .s { display: block; font-size: 11.5px; color: var(--mut); margin-top: 2px; }
  .v { flex: none; font-size: 12.5px; font-weight: 700; color: var(--tx2); font-variant-numeric: tabular-nums; }
  .ok {
    flex: none; padding: 7px 12px; border-radius: var(--r-control);
    background: var(--fill-strong); color: var(--tx);
    font-size: 12px; font-weight: 700; min-height: 36px;
  }
  .no {
    flex: none; padding: 7px 12px; border-radius: var(--r-control);
    background: var(--fill); color: var(--mut);
    font-size: 12px; font-weight: 700; min-height: 36px;
  }
</style>
