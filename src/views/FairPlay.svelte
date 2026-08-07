<script lang="ts">
  // Fair Play — the household's recurring responsibilities as owned "cards".
  // Each is held end-to-end by one person to an agreed standard; the balance bar
  // up top makes the split between Christo & Mandri visible at a glance.
  import { onMount } from "svelte";
  import { toast } from "../lib/toast.svelte";
  import {
    OWNERS, CADENCES, watchResponsibilities, addResponsibility, updateResponsibility,
    removeResponsibility, seedStarter, STARTER, type Responsibility, type Owner, type Cadence,
  } from "../lib/fairplay";

  const isMock = typeof location !== "undefined" && new URLSearchParams(location.search).get("mock") === "1";

  let items = $state<Responsibility[]>([]);
  let filter = $state<"all" | Owner>("all");
  let adding = $state(false);
  let draft = $state<{ title: string; owner: Owner; cadence: Cadence; standard: string }>({ title: "", owner: "Shared", cadence: "weekly", standard: "" });

  onMount(() => {
    if (isMock) { items = STARTER.map((r, i) => ({ id: String(i), ts: i, ...r })); return; }
    const u = watchResponsibilities((r) => (items = r));
    return () => u();
  });

  const OWNER_COLOR: Record<Owner, string> = { Christo: "var(--acc)", Mandri: "var(--health, #f472b6)", Shared: "var(--water)" };
  const counts = $derived({
    Christo: items.filter((i) => i.owner === "Christo").length,
    Mandri: items.filter((i) => i.owner === "Mandri").length,
    Shared: items.filter((i) => i.owner === "Shared").length,
  });
  const total = $derived(items.length || 1);
  const shown = $derived(filter === "all" ? items : items.filter((i) => i.owner === filter));

  function cycleOwner(r: Responsibility) {
    const next = OWNERS[(OWNERS.indexOf(r.owner) + 1) % OWNERS.length];
    if (isMock) { items = items.map((x) => x.id === r.id ? { ...x, owner: next } : x); return; }
    updateResponsibility(r.id, { owner: next });
  }
  async function add() {
    if (!draft.title.trim()) return;
    if (isMock) { items = [...items, { id: String(Date.now()), ts: Date.now(), ...draft, title: draft.title.trim() }]; }
    else { try { await addResponsibility({ ...draft, title: draft.title.trim() }); } catch (e) { toast.show(e instanceof Error ? e.message : String(e)); } }
    draft = { title: "", owner: "Shared", cadence: "weekly", standard: "" }; adding = false;
  }
  async function remove(r: Responsibility) {
    if (isMock) { items = items.filter((x) => x.id !== r.id); return; }
    await removeResponsibility(r.id);
  }
  async function seed() {
    if (isMock) { items = STARTER.map((r, i) => ({ id: String(i), ts: i, ...r })); return; }
    try { await seedStarter(); toast.show("Starter set added"); } catch (e) { toast.show(e instanceof Error ? e.message : String(e)); }
  }
</script>

<div class="col">
  <div class="hdr">
    <div><h2>Fair Play</h2><p>Who owns each recurring responsibility — end to end, to an agreed standard.</p></div>
    <button class="addbtn" onclick={() => (adding = !adding)}>{adding ? "Cancel" : "+ Add"}</button>
  </div>

  <!-- balance bar -->
  {#if items.length}
    <div class="card bal">
      <div class="lb" style="margin-bottom:10px">The load, shared</div>
      <div class="track">
        {#each OWNERS as o}
          {#if counts[o]}<div class="seg" style="flex:{counts[o]};background:{OWNER_COLOR[o]}" title="{o}: {counts[o]}"></div>{/if}
        {/each}
      </div>
      <div class="legend">
        {#each OWNERS as o}
          <button class="lg" class:sel={filter === o} onclick={() => (filter = filter === o ? "all" : o)}>
            <span class="dot" style="background:{OWNER_COLOR[o]}"></span>{o} · {counts[o]}
          </button>
        {/each}
      </div>
    </div>
  {/if}

  {#if adding}
    <div class="card form">
      <input bind:value={draft.title} placeholder="Responsibility (e.g. Meal planning)" />
      <input bind:value={draft.standard} placeholder="Minimum standard of care (what 'done well' means)" />
      <div class="frow">
        <div class="seg-pick">
          {#each OWNERS as o}<button class:sel={draft.owner === o} style="--c:{OWNER_COLOR[o]}" onclick={() => (draft.owner = o)}>{o}</button>{/each}
        </div>
        <select bind:value={draft.cadence}>{#each CADENCES as c}<option value={c}>{c}</option>{/each}</select>
        <button class="save" onclick={add}>Add</button>
      </div>
    </div>
  {/if}

  {#if items.length === 0}
    <div class="card empty">
      <p>No responsibilities mapped yet.</p>
      <button class="seed" onclick={seed}>Load a starter set for a young family</button>
    </div>
  {:else}
    <div class="list">
      {#each shown as r (r.id)}
        <div class="rcard" style="--c:{OWNER_COLOR[r.owner]}">
          <button class="owner" onclick={() => cycleOwner(r)} title="Tap to reassign">{r.owner}</button>
          <div class="body">
            <div class="title">{r.title}</div>
            {#if r.standard}<div class="std">{r.standard}</div>{/if}
            <div class="meta">{r.cadence ?? ""}{r.area ? ` · ${r.area}` : ""}</div>
          </div>
          <button class="del" onclick={() => remove(r)} aria-label="Remove">✕</button>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .col { display: flex; flex-direction: column; gap: 14px; }
  .hdr { display: flex; align-items: flex-end; justify-content: space-between; gap: 14px; }
  .hdr h2 { font-size: 20px; font-weight: 800; margin: 0; }
  .hdr p { font-size: 12.5px; color: var(--muted); margin: 4px 0 0; max-width: 52ch; }
  .addbtn { padding: 9px 15px; border-radius: 11px; background: rgba(255,255,255,0.06); color: var(--text-2); font-size: 13px; font-weight: 600; flex: none; }
  .addbtn:hover { background: rgba(255,255,255,0.1); color: var(--text); }
  .card { background: var(--card, rgba(255,255,255,0.04)); border: 1px solid var(--line, rgba(255,255,255,0.08)); border-radius: 18px; padding: 18px; }
  .lb { font-size: 11px; font-weight: 700; letter-spacing: 0.09em; text-transform: uppercase; color: var(--muted); }

  .track { display: flex; height: 12px; border-radius: 999px; overflow: hidden; background: rgba(255,255,255,0.06); gap: 2px; }
  .seg { min-width: 6px; transition: flex 0.4s ease; }
  .legend { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
  .lg { display: flex; align-items: center; gap: 7px; font-size: 12px; font-weight: 600; color: var(--text-2); padding: 5px 11px; border-radius: 999px; background: rgba(255,255,255,0.05); }
  .lg.sel { box-shadow: inset 0 0 0 1.5px var(--line); color: var(--text); }
  .dot { width: 9px; height: 9px; border-radius: 50%; }

  .form { display: flex; flex-direction: column; gap: 10px; }
  .form input { padding: 10px 13px; border-radius: 11px; background: rgba(255,255,255,0.05); border: 1px solid var(--line, rgba(255,255,255,0.08)); color: var(--text); font-size: 13px; }
  .frow { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
  .seg-pick { display: flex; gap: 6px; }
  .seg-pick button { padding: 8px 13px; border-radius: 9px; background: rgba(255,255,255,0.05); font-size: 12.5px; font-weight: 600; color: var(--text-2); }
  .seg-pick button.sel { background: color-mix(in srgb, var(--c) 18%, transparent); color: var(--c); box-shadow: inset 0 0 0 1.5px var(--c); }
  .frow select { padding: 9px 12px; border-radius: 10px; background: rgba(255,255,255,0.05); border: 1px solid var(--line, rgba(255,255,255,0.08)); color: var(--text); font-size: 12.5px; }
  .save { margin-left: auto; padding: 10px 18px; border-radius: 11px; background: var(--grad, var(--acc)); color: #05070c; font-weight: 700; font-size: 13px; }

  .list { display: flex; flex-direction: column; gap: 10px; }
  .rcard { display: flex; align-items: center; gap: 14px; padding: 14px 16px; border-radius: 15px; background: var(--card, rgba(255,255,255,0.04)); border: 1px solid var(--line, rgba(255,255,255,0.08)); border-left: 3px solid var(--c); }
  .owner { flex: none; width: 74px; text-align: center; font-size: 11.5px; font-weight: 800; color: var(--c); background: color-mix(in srgb, var(--c) 14%, transparent); border-radius: 10px; padding: 8px 4px; }
  .body { flex: 1; min-width: 0; }
  .title { font-size: 14px; font-weight: 700; color: var(--text); }
  .std { font-size: 12px; color: var(--text-2); margin-top: 3px; line-height: 1.4; }
  .meta { font-size: 10.5px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; margin-top: 5px; }
  .del { width: 28px; height: 28px; border-radius: 8px; color: var(--muted); font-size: 12px; flex: none; }
  .del:hover { background: rgba(255,255,255,0.08); color: var(--text); }
  .empty { text-align: center; color: var(--muted); }
  .empty p { margin: 0 0 12px; font-size: 13px; }
  .seed { padding: 10px 18px; border-radius: 11px; background: var(--grad, var(--acc)); color: #05070c; font-weight: 700; font-size: 13px; }
</style>
