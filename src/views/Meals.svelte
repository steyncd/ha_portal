<script lang="ts">
  // Meals — a shared weekly dinner plan + a household shopping list, both
  // Firestore-backed so anyone in the family sees the same thing live.
  import { onMount } from "svelte";
  import {
    DAYS, todayKey, watchMealPlan, setMeal,
    watchShopping, addShopping, toggleShopping, removeShopping, clearDoneShopping,
    type MealPlan, type ShoppingItem,
  } from "../lib/meals";
  import { toast } from "../lib/toast.svelte";

  const isMock = typeof location !== "undefined" && new URLSearchParams(location.search).get("mock") === "1";
  const today = todayKey();

  let plan = $state<MealPlan>({});
  let items = $state<ShoppingItem[]>([]);
  let editDay = $state<string | null>(null);
  let draft = $state("");
  let newItem = $state("");

  onMount(() => {
    if (isMock) {
      plan = { mon: { dinner: "Spaghetti bolognaise" }, tue: { dinner: "Chicken & rice" }, wed: { dinner: "Braai" }, thu: { dinner: "Fish & veg" }, fri: { dinner: "Pizza night" }, sat: { dinner: "Leftovers" }, sun: { dinner: "Roast chicken" } };
      items = [
        { id: "1", text: "Milk", done: false }, { id: "2", text: "Chicken", done: false },
        { id: "3", text: "Tomatoes", done: true }, { id: "4", text: "Bread", done: false },
      ];
      return;
    }
    const u1 = watchMealPlan((p) => (plan = p));
    const u2 = watchShopping((i) => (items = i));
    return () => { u1(); u2(); };
  });

  const pending = $derived(items.filter((i) => !i.done));
  const done = $derived(items.filter((i) => i.done));

  function edit(day: string) { editDay = day; draft = plan[day]?.dinner ?? ""; }
  async function save(day: string) {
    if (isMock) { plan = { ...plan, [day]: { dinner: draft.trim() } }; editDay = null; return; }
    try { await setMeal(day, draft); editDay = null; } catch (e) { toast.show(e instanceof Error ? e.message : String(e)); }
  }
  async function add() {
    const t = newItem.trim(); if (!t) return;
    if (isMock) { items = [...items, { id: String(Date.now()), text: t, done: false }]; newItem = ""; return; }
    try { await addShopping(t); newItem = ""; } catch (e) { toast.show(e instanceof Error ? e.message : String(e)); }
  }
  async function toggle(i: ShoppingItem) {
    if (isMock) { items = items.map((x) => x.id === i.id ? { ...x, done: !x.done } : x); return; }
    await toggleShopping(i.id, !i.done);
  }
  async function remove(i: ShoppingItem) {
    if (isMock) { items = items.filter((x) => x.id !== i.id); return; }
    await removeShopping(i.id);
  }
  async function clearDone() {
    if (isMock) { items = items.filter((x) => !x.done); return; }
    try { await clearDoneShopping(); } catch (e) { toast.show(e instanceof Error ? e.message : String(e)); }
  }
</script>

<div class="grid">
  <!-- weekly dinners -->
  <div class="card pad">
    <div class="rh"><span class="lb">🍽️ This week's dinners</span><span class="sub">tap a day to edit</span></div>
    <div class="week">
      {#each DAYS as d (d.key)}
        <div class="day" class:today={d.key === today}>
          <div class="dl">{d.label}{#if d.key === today}<span class="tt">Today</span>{/if}</div>
          {#if editDay === d.key}
            <form class="de" onsubmit={(e) => { e.preventDefault(); save(d.key); }}>
              <input bind:value={draft} placeholder="What's for dinner?" autofocus />
              <button type="submit" class="sv">Save</button>
            </form>
          {:else}
            <button class="dv" onclick={() => edit(d.key)}>
              {#if plan[d.key]?.dinner}<span class="meal">{plan[d.key].dinner}</span>{:else}<span class="ph">+ Add dinner</span>{/if}
            </button>
          {/if}
        </div>
      {/each}
    </div>
  </div>

  <!-- shopping list -->
  <div class="card pad">
    <div class="rh"><span class="lb">🛒 Shopping list</span><span class="sub">{pending.length} to buy</span></div>
    <form class="addrow" onsubmit={(e) => { e.preventDefault(); add(); }}>
      <input bind:value={newItem} placeholder="Add an item…" />
      <button class="addbtn" type="submit">Add</button>
    </form>
    <div class="items">
      {#each pending as i (i.id)}
        <div class="item">
          <button class="chk" onclick={() => toggle(i)} aria-label="Mark bought"></button>
          <span class="it">{i.text}</span>
          <button class="del" onclick={() => remove(i)} aria-label="Remove">✕</button>
        </div>
      {/each}
      {#if pending.length === 0}<div class="empty">Nothing to buy — nice.</div>{/if}
    </div>
    {#if done.length}
      <div class="donehdr"><span>Bought ({done.length})</span><button class="clr" onclick={clearDone}>Clear</button></div>
      <div class="items">
        {#each done as i (i.id)}
          <div class="item done">
            <button class="chk on" onclick={() => toggle(i)} aria-label="Unmark">✓</button>
            <span class="it">{i.text}</span>
            <button class="del" onclick={() => remove(i)} aria-label="Remove">✕</button>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .grid { display: grid; grid-template-columns: 1.2fr 1fr; gap: 14px; align-items: start; }
  @media (max-width: 820px) { .grid { grid-template-columns: 1fr; } }
  .card { background: var(--card, rgba(255,255,255,0.04)); border: 1px solid var(--line, rgba(255,255,255,0.08)); border-radius: 18px; }
  .pad { padding: 18px; }
  .rh { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 14px; }
  .lb { font-size: 13px; font-weight: 700; color: var(--text-2); }
  .sub { font-size: 12px; color: var(--dim); }

  .week { display: flex; flex-direction: column; gap: 8px; }
  .day { padding: 12px 14px; border-radius: 13px; background: rgba(255,255,255,0.03); }
  .day.today { background: color-mix(in srgb, var(--acc) 12%, transparent); box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--acc) 40%, transparent); }
  .dl { font-size: 11.5px; font-weight: 700; color: var(--muted); display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
  .tt { font-size: 9.5px; color: var(--acc); background: color-mix(in srgb, var(--acc) 18%, transparent); border-radius: 999px; padding: 2px 7px; letter-spacing: 0.03em; }
  .dv { display: block; width: 100%; text-align: left; }
  .meal { font-size: 14.5px; font-weight: 600; color: var(--text); }
  .ph { font-size: 13px; color: var(--muted-2, var(--muted)); }
  .dv:hover .ph { color: var(--text-2); }
  .de { display: flex; gap: 8px; }
  .de input { flex: 1; padding: 9px 12px; border-radius: 10px; background: rgba(255,255,255,0.06); border: 1px solid var(--line, rgba(255,255,255,0.1)); color: var(--text); font-size: 14px; }
  .sv { padding: 9px 14px; border-radius: 10px; background: var(--grad, var(--acc)); color: #05070c; font-weight: 700; font-size: 12.5px; }

  .addrow { display: flex; gap: 8px; margin-bottom: 14px; }
  .addrow input { flex: 1; padding: 10px 13px; border-radius: 11px; background: rgba(255,255,255,0.05); border: 1px solid var(--line, rgba(255,255,255,0.08)); color: var(--text); font-size: 13px; }
  .addbtn { padding: 10px 16px; border-radius: 11px; background: var(--grad, var(--acc)); color: #05070c; font-weight: 700; font-size: 13px; }
  .items { display: flex; flex-direction: column; gap: 6px; }
  .item { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 11px; background: rgba(255,255,255,0.03); }
  .item.done .it { text-decoration: line-through; color: var(--muted); }
  .chk { width: 22px; height: 22px; border-radius: 7px; border: 2px solid var(--line, rgba(255,255,255,0.2)); background: transparent; flex: none; font-size: 12px; color: #05070c; display: grid; place-items: center; }
  .chk.on { background: var(--success); border-color: var(--success); }
  .it { flex: 1; min-width: 0; font-size: 13.5px; color: var(--text); }
  .del { width: 26px; height: 26px; border-radius: 7px; color: var(--muted); font-size: 12px; flex: none; }
  .del:hover { background: rgba(255,255,255,0.08); color: var(--text); }
  .empty { font-size: 12.5px; color: var(--muted); padding: 12px; text-align: center; }
  .donehdr { display: flex; justify-content: space-between; align-items: center; margin: 16px 0 8px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); }
  .clr { font-size: 11px; color: var(--acc2, var(--acc)); font-weight: 600; }
</style>
