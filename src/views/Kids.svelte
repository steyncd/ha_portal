<script lang="ts">
  // Kids — per-child daily routines, chores (family contributions + paid extras),
  // a running allowance balance, and an owner "pay out" that banks it to Steyn
  // Finance. Firestore-backed so both parents and the boys see the same thing.
  import { onMount } from "svelte";
  import { authStore } from "../lib/auth.svelte";
  import { toast } from "../lib/toast.svelte";
  import {
    KIDS, CHORES, ROUTINE, watchKid, toggleChore, toggleRoutine, payout,
    choresToday, routineToday, type KidState,
  } from "../lib/kids";

  const isMock = typeof location !== "undefined" && new URLSearchParams(location.search).get("mock") === "1";
  const isOwner = $derived(isMock || authStore.role === "owner" || authStore.isOwner);

  let kidStates = $state<Record<string, KidState>>({});
  let activeKid = $state(KIDS[0].slug);

  onMount(() => {
    if (isMock) {
      kidStates = {
        liam: { balance: 18, paidTotal: 240, todayDate: todayLocal(), choresDone: ["pets", "dishes"], routineDone: ["m_wake", "m_dress", "m_teeth"] },
        eben: { balance: 6, paidTotal: 95, todayDate: todayLocal(), choresDone: ["table"], routineDone: ["m_wake"] },
      };
      return;
    }
    const unsubs = KIDS.map((k) => watchKid(k.slug, (s) => (kidStates = { ...kidStates, [k.slug]: s })));
    return () => unsubs.forEach((u) => u());
  });

  function todayLocal() { const s = new Date(Date.now() + 2 * 3600_000); return `${s.getUTCFullYear()}-${String(s.getUTCMonth() + 1).padStart(2, "0")}-${String(s.getUTCDate()).padStart(2, "0")}`; }

  const kid = $derived(KIDS.find((k) => k.slug === activeKid)!);
  const ks = $derived(kidStates[activeKid] ?? {});
  const cDone = $derived(choresToday(ks));
  const rDone = $derived(routineToday(ks));
  const morning = ROUTINE.filter((r) => r.period === "morning");
  const evening = ROUTINE.filter((r) => r.period === "evening");
  const routineProgress = $derived(Math.round((rDone.length / ROUTINE.length) * 100));

  async function chore(c: (typeof CHORES)[number]) {
    if (isMock) {
      const done = cDone.includes(c.id);
      const nd = done ? cDone.filter((x) => x !== c.id) : [...cDone, c.id];
      kidStates = { ...kidStates, [activeKid]: { ...ks, todayDate: todayLocal(), choresDone: nd, balance: Math.max(0, (ks.balance ?? 0) + (done ? -c.rand : c.rand)) } };
      return;
    }
    await toggleChore(activeKid, ks, c);
  }
  async function routine(id: string) {
    if (isMock) {
      const done = rDone.includes(id);
      kidStates = { ...kidStates, [activeKid]: { ...ks, todayDate: todayLocal(), routineDone: done ? rDone.filter((x) => x !== id) : [...rDone, id] } };
      return;
    }
    await toggleRoutine(activeKid, ks, id);
  }
  async function pay() {
    const amt = ks.balance ?? 0;
    if (amt <= 0) { toast.show("Nothing to pay out yet"); return; }
    if (isMock) { kidStates = { ...kidStates, [activeKid]: { ...ks, balance: 0, lastPayout: Date.now() } }; toast.show(`Paid out R${amt} to ${kid.name}`); return; }
    try { await payout(activeKid, ks); toast.show(`Paid out R${amt} to ${kid.name} → Steyn Finance`); }
    catch (e) { toast.show(e instanceof Error ? e.message : String(e)); }
  }
</script>

<div class="col">
  <div class="hdr">
    <div><h2>Kids</h2><p>Daily routines, chores and pocket money for Liam &amp; Eben.</p></div>
    <div class="tabs">
      {#each KIDS as k (k.slug)}
        <button class="tab" class:sel={activeKid === k.slug} onclick={() => (activeKid = k.slug)} style="--kc:{k.color}">
          <span class="ti">{k.icon}</span>{k.name}
        </button>
      {/each}
    </div>
  </div>

  <!-- balance -->
  <div class="card bal" style="--kc:{kid.color}">
    <span class="glow"></span>
    <div class="balx">
      <div class="lb">{kid.name}'s pocket money</div>
      <div class="amt">R{ks.balance ?? 0}</div>
      <div class="sub">{(ks.paidTotal ?? 0) > 0 ? `R${ks.paidTotal} earned all-time` : "Earn by doing paid jobs"}</div>
    </div>
    {#if isOwner}
      <button class="payout" onclick={pay} disabled={(ks.balance ?? 0) <= 0}>Pay out →</button>
    {/if}
  </div>

  <!-- routine -->
  <div class="card">
    <div class="rh"><span class="lb">Today's routine</span><span class="sub">{rDone.length}/{ROUTINE.length} done · {routineProgress}%</span></div>
    <div class="bar"><div class="fill" style="width:{routineProgress}%;background:{kid.color}"></div></div>
    <div class="rgrid">
      <div class="period">
        <div class="ph">🌅 Morning</div>
        {#each morning as r (r.id)}
          <button class="ritem" class:on={rDone.includes(r.id)} onclick={() => routine(r.id)}>
            <span class="rc">{rDone.includes(r.id) ? "✓" : ""}</span><span class="ri">{r.icon}</span><span class="rl">{r.label}</span>
          </button>
        {/each}
      </div>
      <div class="period">
        <div class="ph">🌙 Evening</div>
        {#each evening as r (r.id)}
          <button class="ritem" class:on={rDone.includes(r.id)} onclick={() => routine(r.id)}>
            <span class="rc">{rDone.includes(r.id) ? "✓" : ""}</span><span class="ri">{r.icon}</span><span class="rl">{r.label}</span>
          </button>
        {/each}
      </div>
    </div>
  </div>

  <!-- chores -->
  <div class="card">
    <div class="rh"><span class="lb">Chores</span><span class="sub">💛 = family job · green = paid</span></div>
    <div class="cgrid">
      {#each CHORES as c (c.id)}
        {@const done = cDone.includes(c.id)}
        <button class="chore" class:on={done} class:paid={c.rand > 0} onclick={() => chore(c)}>
          <span class="chi">{c.icon}</span>
          <span class="chl">{c.label}</span>
          <span class="chr">{c.rand > 0 ? `R${c.rand}` : "💛"}</span>
          {#if done}<span class="chd">✓</span>{/if}
        </button>
      {/each}
    </div>
  </div>
</div>

<style>
  .col { display: flex; flex-direction: column; gap: 14px; }
  .hdr { display: flex; align-items: flex-end; justify-content: space-between; gap: 14px; flex-wrap: wrap; }
  .hdr h2 { font-size: 20px; font-weight: 800; margin: 0; }
  .hdr p { font-size: 12.5px; color: var(--muted); margin: 4px 0 0; }
  .tabs { display: flex; gap: 8px; }
  .tab { display: flex; align-items: center; gap: 7px; padding: 9px 15px; border-radius: 12px; background: rgba(255,255,255,0.05); font-size: 13px; font-weight: 600; color: var(--text-2); }
  .tab.sel { background: color-mix(in srgb, var(--kc) 18%, transparent); color: var(--text); box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--kc) 45%, transparent); }
  .ti { font-size: 16px; }

  .card { position: relative; background: var(--card, rgba(255,255,255,0.04)); border: 1px solid var(--line, rgba(255,255,255,0.08)); border-radius: 18px; padding: 18px; overflow: hidden; }
  .lb { font-size: 11px; font-weight: 700; color: var(--muted); }
  .sub { font-size: 12px; color: var(--dim); }
  .rh { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 12px; }

  .bal { display: flex; align-items: center; justify-content: space-between; gap: 14px; }
  .bal .glow { position: absolute; inset: 0; background: radial-gradient(120% 90% at 85% -20%, color-mix(in srgb, var(--kc) 22%, transparent), transparent 60%); pointer-events: none; }
  .amt { font-size: 40px; font-weight: 800; letter-spacing: -1.5px; margin: 4px 0 2px; }
  .payout { position: relative; padding: 12px 20px; border-radius: 13px; background: var(--grad, var(--acc)); color: #05070c; font-weight: 800; font-size: 14px; flex: none; }
  .payout:disabled { opacity: 0.4; }

  .bar { height: 7px; border-radius: 999px; background: rgba(255,255,255,0.08); overflow: hidden; margin-bottom: 14px; }
  .fill { height: 100%; border-radius: 999px; transition: width 0.4s ease; }
  .rgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  @media (max-width: 640px) { .rgrid { grid-template-columns: 1fr; } }
  .ph { font-size: 12px; font-weight: 700; color: var(--text-2); margin-bottom: 8px; }
  .period { display: flex; flex-direction: column; gap: 6px; }
  .ritem { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 11px; background: rgba(255,255,255,0.03); text-align: left; }
  .ritem.on { background: color-mix(in srgb, var(--success) 12%, transparent); }
  .ritem.on .rl { color: var(--muted); text-decoration: line-through; }
  .rc { width: 18px; height: 18px; border-radius: 6px; border: 2px solid var(--line, rgba(255,255,255,0.2)); font-size: 11px; color: var(--success); display: grid; place-items: center; flex: none; }
  .ritem.on .rc { background: var(--success); border-color: var(--success); color: #05070c; }
  .ri { font-size: 15px; } .rl { font-size: 12.5px; font-weight: 600; color: var(--text); }

  .cgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
  .chore { position: relative; display: flex; flex-direction: column; align-items: flex-start; gap: 5px; padding: 13px; border-radius: 14px; background: rgba(255,255,255,0.04); text-align: left; }
  .chore .chr { font-size: 12px; font-weight: 800; color: var(--muted-2, var(--muted)); }
  .chore.paid .chr { color: var(--success); }
  .chore.on { box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--success) 55%, transparent); background: color-mix(in srgb, var(--success) 10%, transparent); }
  .chi { font-size: 20px; }
  .chl { font-size: 12.5px; font-weight: 600; color: var(--text); line-height: 1.25; }
  .chd { position: absolute; top: 10px; right: 11px; width: 20px; height: 20px; border-radius: 50%; background: var(--success); color: #05070c; font-size: 12px; font-weight: 800; display: grid; place-items: center; }
</style>
