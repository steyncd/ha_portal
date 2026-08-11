<script lang="ts">
  // Life → the family "Life OS" hub: Tasks & Chores, Money (bills + running
  // cost), and Shopping & Meals. All Firestore-backed + real-time.
  import { onMount } from "svelte";
  import { ha } from "../lib/store.svelte";
  import { life, FAMILY, familyLabel, familyShort, type Kind, type LifeItem } from "../lib/life.svelte";
  import { bills, shopping, meals, journal, dueInDays, monthKey, DAYS, type Bill, type ShopItem } from "../lib/lifePlus.svelte";
  import { leaderboard, unpaidBills, dueSoonBills, categoryBreakdown } from "../lib/lifeCalc";
  import { toast } from "../lib/toast.svelte";
  import { auth } from "../lib/firebase";
  import { n } from "../lib/format";

  onMount(() => {
    life.start(); bills.start(); shopping.start(); meals.start(); journal.start();
    return () => { life.stop(); bills.stop(); shopping.stop(); meals.stop(); journal.stop(); };
  });

  let hub = $state<"tasks" | "money" | "shopping" | "journal">("tasks");

  // ============ TASKS ============
  let title = $state(""); let kind = $state<Kind>("task"); let assignee = $state(""); let points = $state(1); let due = $state("");
  async function add() {
    const t = title.trim(); if (!t) return;
    try { await life.add({ title: t, kind, assignee, points, due: due || null }); toast.show(`${kind === "chore" ? "Chore" : "Task"} added`); title = ""; due = ""; }
    catch { toast.show("Couldn't save — check you're signed in"); }
  }
  let tab = $state<"all" | "task" | "chore">("all");
  let who = $state("");
  const shown = $derived(life.items.filter((i) => (tab === "all" || i.kind === tab) && (who === "" || i.assignee === who)));
  const chores = $derived(shown.filter((i) => i.kind === "chore"));
  const tasks = $derived(shown.filter((i) => i.kind === "task"));
  const openCount = $derived(life.items.filter((i) => !i.done).length);
  const board = $derived(leaderboard(FAMILY, life.items));
  const topPts = $derived(Math.max(1, ...board.map((b) => b.pts)));
  async function complete(i: LifeItem) { await life.toggle(i.id, !i.done); if (!i.done && i.points > 0 && i.assignee) toast.show(`${familyLabel(i.assignee)} +${i.points} ⭐`); }
  async function resetChores() { await life.resetChores(); toast.show("Chores reset for a new day"); }
  const dueLabel = (d: string | null) => {
    if (!d) return ""; const t = new Date(d + "T00:00:00").getTime(); const today = new Date(); today.setHours(0, 0, 0, 0);
    const diff = Math.round((t - today.getTime()) / 864e5);
    if (diff < 0) return `${-diff}d overdue`; if (diff === 0) return "today"; if (diff === 1) return "tomorrow";
    return new Date(t).toLocaleDateString("en-ZA", { day: "numeric", month: "short" });
  };
  // documents -> reminders
  let docBusy = $state(false);
  async function onDocFile(e: Event) {
    const input = e.currentTarget as HTMLInputElement; const file = input.files?.[0]; if (!file) return;
    docBusy = true;
    try {
      const b64 = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1] ?? ""); r.onerror = () => rej(new Error("read failed")); r.readAsDataURL(file); });
      const token = await auth.currentUser?.getIdToken();
      const resp = await fetch("/api/parse-document", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ fileBase64: b64, mimeType: file.type || "application/pdf", kind: "renewal" }) });
      const j = await resp.json(); if (!j.ok) throw new Error(j.error || "parse failed");
      const ex = j.extracted ?? {}; const label = (ex.label || file.name.replace(/\.[^.]+$/, "")).toString();
      const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(ex.expiry_date || "") ? ex.expiry_date : null;
      await life.add({ title: `Renew ${label}`, kind: "task", assignee: "", points: 0, due: dueDate, notes: "from document" });
      toast.show(dueDate ? `Reminder set — renew ${label} by ${dueDate}` : `Added — renew ${label}`);
    } catch { toast.show("Couldn't read that document — try a clearer photo or PDF"); }
    finally { docBusy = false; input.value = ""; }
  }

  // ============ MONEY ============
  const costToday = $derived(ha.num("sensor.energy_cost_today"));
  const costMonth = $derived(ha.num("sensor.energy_cost_this_month"));
  const costProj = $derived(ha.num("sensor.energy_cost_projected_monthly"));
  const costBudget = $derived(ha.num("input_number.monthly_cost_budget") ?? 1500);
  const budgetPct = $derived(Math.min(100, ((costMonth ?? 0) / Math.max(1, costBudget)) * 100));

  let bName = $state(""); let bAmt = $state(0); let bDay = $state(1); let bCat = $state("Utilities"); let bAuto = $state(false);
  const CATS = ["Utilities", "Insurance", "Subscriptions", "Home", "School", "Vehicle", "Other"];
  async function addBill() {
    const nm = bName.trim(); if (!nm) return;
    try { await bills.add({ name: nm, amount: bAmt, dueDay: bDay, category: bCat, autopay: bAuto }); toast.show("Bill added"); bName = ""; bAmt = 0; }
    catch { toast.show("Couldn't save"); }
  }
  const thisMonth = monthKey();
  const unpaid = $derived(unpaidBills(bills.items));
  const dueSoon = $derived(dueSoonBills(bills.items, 7));
  const unpaidTotal = $derived(unpaid.reduce((s, b) => s + b.amount, 0));
  const monthlyTotal = $derived(bills.items.reduce((s, b) => s + b.amount, 0));
  const dueChip = (b: Bill) => { const d = dueInDays(b.dueDay); return d === 0 ? "due today" : d === 1 ? "tomorrow" : `in ${d}d`; };
  const catBreak = $derived(categoryBreakdown(bills.items));

  // ============ SHOPPING ============
  let shopItem = $state("");
  async function addShop() { const t = shopItem.trim(); if (!t) return; try { await shopping.add(t); shopItem = ""; } catch { toast.show("Couldn't add"); } }
  let mealsBusy = $state(false);
  const hasMeals = $derived(DAYS.some((d) => (meals.data[d.key] ?? "").trim()));
  async function planFromMeals() {
    if (mealsBusy) return; mealsBusy = true;
    try {
      const token = await auth.currentUser?.getIdToken();
      const resp = await fetch("/api/meals-to-shopping", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } });
      const j = await resp.json(); if (!j.ok) throw new Error(j.error || "failed");
      toast.show(j.added ? `Added ${j.added} ingredient${j.added === 1 ? "" : "s"} to the list` : "Nothing new to add");
    } catch { toast.show("Couldn't build the list — try again"); }
    finally { mealsBusy = false; }
  }

  // ============ JOURNAL ============
  const jFmt = (d: string) => { const t = new Date(d + "T00:00:00"); return t.toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long" }); };
</script>

<div class="col">
  <div class="hdr">
    <div><h2>Life</h2><p>Tasks, money &amp; the kitchen — shared with the whole house</p></div>
  </div>

  <div class="hub">
    <button class:on={hub === "tasks"} onclick={() => (hub = "tasks")}>✅ Tasks</button>
    <button class:on={hub === "money"} onclick={() => (hub = "money")}>💰 Money</button>
    <button class:on={hub === "shopping"} onclick={() => (hub = "shopping")}>🛒 Shopping</button>
    <button class:on={hub === "journal"} onclick={() => (hub = "journal")}>📓 Journal</button>
  </div>

  {#if hub === "tasks"}
    <div class="card pad board">
      <div class="rh"><span class="lb">⭐ Points this week</span><span class="sub">{openCount} open</span></div>
      <div class="brows">
        {#each board as b (b.key)}
          <div class="brow"><span class="av av-{b.key}">{b.short}</span><span class="bn">{b.label}</span><div class="btrack"><div class="bfill f-{b.key}" style="width:{(b.pts / topPts) * 100}%"></div></div><span class="bp">{b.pts}</span></div>
        {/each}
      </div>
    </div>

    <div class="card pad add">
      <input class="ti" bind:value={title} placeholder="Add a task or chore…" onkeydown={(e) => e.key === "Enter" && add()} />
      <div class="addrow">
        <div class="seg"><button class:on={kind === "task"} onclick={() => (kind = "task")}>Task</button><button class:on={kind === "chore"} onclick={() => (kind = "chore")}>Chore</button></div>
        <select bind:value={assignee} class="sel"><option value="">Anyone</option>{#each FAMILY as f}<option value={f.key}>{f.label}</option>{/each}</select>
        <div class="pts"><button onclick={() => (points = Math.max(0, points - 1))} aria-label="less">−</button><span>{points} ⭐</span><button onclick={() => (points = points + 1)} aria-label="more">+</button></div>
        <input type="date" bind:value={due} class="date" />
        <button class="save" onclick={add}>Add</button>
      </div>
    </div>

    <div class="card pad docs">
      <div class="drow">
        <div><div class="lb">📄 Documents → reminders</div><div class="dsub">Upload a licence disc, insurance or warranty — it reads the expiry and adds a renewal reminder.</div></div>
        <label class="uploader" class:busy={docBusy}>{docBusy ? "Reading…" : "＋ Upload"}<input type="file" accept="image/*,application/pdf" onchange={onDocFile} disabled={docBusy} hidden /></label>
      </div>
      <div class="cap">💬 Or WhatsApp the house — <b>"add: fix the gate light"</b> or <b>"buy milk"</b> — and it lands here automatically.</div>
    </div>

    <div class="filters">
      <div class="seg"><button class:on={tab === "all"} onclick={() => (tab = "all")}>All</button><button class:on={tab === "chore"} onclick={() => (tab = "chore")}>Chores</button><button class:on={tab === "task"} onclick={() => (tab = "task")}>Tasks</button></div>
      <div class="people">
        <button class="pchip" class:on={who === ""} onclick={() => (who = "")}>Everyone</button>
        {#each FAMILY as f}<button class="pchip" class:on={who === f.key} onclick={() => (who = f.key)}><span class="av sm av-{f.key}">{f.short}</span>{f.label}</button>{/each}
      </div>
      <button class="reset" onclick={resetChores}>↻ New day</button>
    </div>

    {#if !life.ready}<div class="card pad muted">Loading…</div>{:else if shown.length === 0}<div class="card pad muted">Nothing here yet — add the first {tab === "chore" ? "chore" : "task"} above.</div>{/if}
    {#if chores.length && tab !== "task"}<div class="sec"><span class="sl">🔁 Chores</span></div><div class="list">{#each chores as i (i.id)}{@render item(i)}{/each}</div>{/if}
    {#if tasks.length && tab !== "chore"}<div class="sec"><span class="sl">✔️ Tasks</span></div><div class="list">{#each tasks as i (i.id)}{@render item(i)}{/each}</div>{/if}

  {:else if hub === "money"}
    <!-- house running cost -->
    <div class="card pad">
      <div class="rh"><span class="lb">⚡ What the house is costing</span><span class="sub">electricity</span></div>
      <div class="cost3">
        <div class="cc"><div class="cv">R{n(costToday)}</div><div class="ck">today</div></div>
        <div class="cc"><div class="cv">R{n(costMonth)}</div><div class="ck">this month</div></div>
        <div class="cc"><div class="cv">R{n(costProj)}</div><div class="ck">projected</div></div>
      </div>
      <div class="bud"><div class="budtrack"><div class="budfill" class:over={budgetPct >= 100} style="width:{budgetPct}%"></div></div><div class="budlbl">R{n(costMonth)} of R{n(costBudget)} budget · {n(budgetPct)}%</div></div>
    </div>

    <!-- bills summary -->
    <div class="tiles3">
      <div class="tt"><div class="tv">R{n(unpaidTotal)}</div><div class="tk">still to pay</div></div>
      <div class="tt"><div class="tv">{dueSoon.length}</div><div class="tk">due within 7 days</div></div>
      <div class="tt"><div class="tv">R{n(monthlyTotal)}</div><div class="tk">monthly bills</div></div>
    </div>

    <!-- add bill -->
    <div class="card pad add">
      <div class="addrow">
        <input class="ti flex" bind:value={bName} placeholder="Bill or subscription…" />
        <input type="number" class="num" bind:value={bAmt} placeholder="R" />
        <select bind:value={bDay} class="sel">{#each Array(28) as _, d}<option value={d + 1}>{d + 1}{["st","nd","rd"][d] || (d === 0 ? "st" : "th")}</option>{/each}</select>
        <select bind:value={bCat} class="sel">{#each CATS as c}<option value={c}>{c}</option>{/each}</select>
        <label class="chkl"><input type="checkbox" bind:checked={bAuto} /> Autopay</label>
        <button class="save" onclick={addBill}>Add</button>
      </div>
    </div>

    {#if catBreak.arr.length > 1}
      <div class="card pad">
        <div class="rh"><span class="lb">📊 Where it goes</span><span class="sub">monthly bills by category</span></div>
        <div class="cats">
          {#each catBreak.arr as c (c.cat)}
            <div class="crow"><span class="cname">{c.cat}</span><div class="ctrack"><div class="cfill" style="width:{(c.amt / catBreak.max) * 100}%"></div></div><span class="camt">R{n(c.amt)}</span></div>
          {/each}
        </div>
      </div>
    {/if}

    {#if !bills.ready}<div class="card pad muted">Loading…</div>{:else if bills.items.length === 0}<div class="card pad muted">No bills yet — add your recurring ones above (rent, insurance, DStv, medical aid…).</div>{/if}
    <div class="list">
      {#each bills.items as b (b.id)}
        {@const paid = b.paidMonth === thisMonth}
        <div class="it bill" class:paid>
          <button class="chk" class:ck={paid} onclick={() => bills.markPaid(b.id, !paid)} aria-label="mark paid">{paid ? "✓" : ""}</button>
          <div class="body"><div class="t">{b.name}</div><div class="meta"><span class="chip">{b.category}</span>{#if b.autopay}<span class="chip">auto</span>{/if}{#if !paid}<span class="chip due" class:over={dueInDays(b.dueDay) <= 2}>{dueChip(b)}</span>{:else}<span class="chip ok">paid</span>{/if}</div></div>
          <div class="amt">R{n(b.amount)}</div>
          <button class="del" onclick={() => bills.remove(b.id)} aria-label="delete">✕</button>
        </div>
      {/each}
    </div>

  {:else if hub === "shopping"}
    <!-- shopping -->
    <div class="card pad add">
      <div class="addrow">
        <input class="ti flex" bind:value={shopItem} placeholder="Add to shopping list…" onkeydown={(e) => e.key === "Enter" && addShop()} />
        <button class="save" onclick={addShop}>Add</button>
        {#if shopping.items.some((i) => i.checked)}<button class="reset" onclick={() => shopping.clearChecked()}>Clear ticked</button>{/if}
      </div>
    </div>
    {#if shopping.ready && shopping.items.length === 0}<div class="card pad muted">List's empty — add what you need, or WhatsApp "buy eggs".</div>{/if}
    <div class="list">
      {#each shopping.items as i (i.id)}
        <div class="it" class:done={i.checked}>
          <button class="chk" class:ck={i.checked} onclick={() => shopping.toggle(i.id, !i.checked)} aria-label="tick">{i.checked ? "✓" : ""}</button>
          <div class="body"><div class="t">{i.item}{#if i.qty}<span class="qty"> · {i.qty}</span>{/if}</div></div>
          <button class="del" onclick={() => shopping.remove(i.id)} aria-label="delete">✕</button>
        </div>
      {/each}
    </div>

    <!-- meal plan -->
    <div class="card pad">
      <div class="rh"><span class="lb">🍽️ This week's meals</span>{#if hasMeals}<button class="reset" onclick={planFromMeals} disabled={mealsBusy}>{mealsBusy ? "Building…" : "🛒 Add ingredients"}</button>{/if}</div>
      <div class="meals">
        {#each DAYS as d}
          <label class="mday"><span class="mdl">{d.label}</span><input value={meals.data[d.key] ?? ""} placeholder="—" onchange={(e) => meals.set(d.key, (e.currentTarget as HTMLInputElement).value)} /></label>
        {/each}
      </div>
      {#if hasMeals}<div class="mhint">"Add ingredients" reads the week's meals and tops up your shopping list — skipping staples and anything already on it.</div>{/if}
    </div>

  {:else}
    <!-- journal -->
    <div class="card pad jintro">
      <div class="lb">📓 The house journal</div>
      <div class="dsub">A quiet, automatic diary — each night the home writes a short note about the day from what actually happened (energy, water, comings &amp; goings, chores ticked off).</div>
    </div>
    {#if !journal.ready}<div class="card pad muted">Loading…</div>
    {:else if journal.items.length === 0}<div class="card pad muted">No entries yet — the first one is written tonight at 10pm.</div>{/if}
    <div class="jlist">
      {#each journal.items as e (e.id)}
        <div class="jentry"><div class="jdate">{jFmt(e.date)}</div><div class="jtext">{e.text}</div></div>
      {/each}
    </div>
  {/if}

  <p class="foot">Shared across everyone signed in · add tasks &amp; shopping by WhatsApp · upload a document for a renewal reminder.</p>
</div>

{#snippet item(i: LifeItem)}
  <div class="it" class:done={i.done}>
    <button class="chk" class:ck={i.done} onclick={() => complete(i)} aria-label="complete">{i.done ? "✓" : ""}</button>
    <div class="body">
      <div class="t">{i.title}</div>
      <div class="meta">
        {#if i.assignee}<span class="av xs av-{i.assignee}">{familyShort(i.assignee)}</span><span class="mn">{familyLabel(i.assignee)}</span>{:else}<span class="mn">Anyone</span>{/if}
        {#if i.points > 0}<span class="chip">⭐ {i.points}</span>{/if}
        {#if i.due}<span class="chip due" class:over={dueLabel(i.due).includes("overdue")}>{dueLabel(i.due)}</span>{/if}
      </div>
    </div>
    <button class="del" onclick={() => life.remove(i.id)} aria-label="delete">✕</button>
  </div>
{/snippet}

<style>
  .col { display: flex; flex-direction: column; gap: 14px; }
  .hdr h2 { font-size: 20px; font-weight: 800; margin: 0; } .hdr p { font-size: 12.5px; color: var(--muted); margin: 4px 0 0; }
  .hub { display: flex; gap: 8px; }
  .hub button { flex: 1; padding: 11px; border-radius: 12px; background: rgba(255,255,255,.05); border: 1px solid var(--line, rgba(255,255,255,.1)); color: var(--text-2, var(--muted)); font-weight: 700; font-size: 13.5px; cursor: pointer; }
  .hub button.on { background: var(--acc); color: #fff; border-color: var(--acc); }
  .card { background: var(--card, rgba(255,255,255,.04)); border: 1px solid var(--line, rgba(255,255,255,.08)); border-radius: 16px; }
  .pad { padding: 16px; }
  .rh { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 12px; }
  .lb { font-size: 13px; font-weight: 700; } .sub { font-size: 12px; color: var(--muted); }
  .muted { color: var(--muted); font-size: 13px; }
  .reset { padding: 8px 12px; border-radius: 11px; background: rgba(255,255,255,.05); border: 1px solid var(--line, rgba(255,255,255,.1)); color: var(--text-2, var(--muted)); font-size: 12.5px; font-weight: 600; cursor: pointer; white-space: nowrap; }
  .reset:hover { background: rgba(255,255,255,.09); }

  .av { width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; font-size: 12px; font-weight: 800; color: #fff; flex: none; }
  .av.sm { width: 20px; height: 20px; font-size: 10px; } .av.xs { width: 18px; height: 18px; font-size: 9.5px; }
  .av-christo { background: #0072B2; } .av-mandri { background: #CC79A7; } .av-liam { background: #E69F00; } .av-eben { background: #009E73; }

  .brows { display: flex; flex-direction: column; gap: 10px; }
  .brow { display: grid; grid-template-columns: 26px 68px 1fr auto; align-items: center; gap: 10px; }
  .bn { font-size: 13px; font-weight: 600; }
  .btrack { height: 9px; border-radius: 999px; background: rgba(255,255,255,.08); overflow: hidden; }
  .bfill { height: 100%; border-radius: 999px; transition: width .4s ease; }
  .f-christo { background: #0072B2; } .f-mandri { background: #CC79A7; } .f-liam { background: #E69F00; } .f-eben { background: #009E73; }
  .bp { font-size: 14px; font-weight: 800; font-variant-numeric: tabular-nums; min-width: 24px; text-align: right; }

  .add { display: flex; flex-direction: column; gap: 10px; }
  .ti { width: 100%; padding: 11px 13px; border-radius: 11px; background: rgba(255,255,255,.05); border: 1px solid var(--line, rgba(255,255,255,.1)); color: var(--text); font-size: 14px; }
  .ti.flex { flex: 1; min-width: 140px; width: auto; }
  .addrow { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .seg { display: inline-flex; background: rgba(255,255,255,.05); border: 1px solid var(--line, rgba(255,255,255,.1)); border-radius: 10px; overflow: hidden; }
  .seg button { padding: 8px 12px; font-size: 12.5px; font-weight: 700; color: var(--muted); cursor: pointer; background: transparent; border: none; }
  .seg button.on { background: var(--acc); color: #fff; }
  .sel, .date, .num { padding: 8px 10px; border-radius: 10px; background: rgba(255,255,255,.05); border: 1px solid var(--line, rgba(255,255,255,.1)); color: var(--text); font-size: 12.5px; }
  .num { width: 84px; } .chkl { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--muted); }
  .pts { display: inline-flex; align-items: center; gap: 8px; padding: 5px 8px; border-radius: 10px; background: rgba(255,255,255,.05); border: 1px solid var(--line, rgba(255,255,255,.1)); font-size: 12.5px; font-weight: 700; }
  .pts button { width: 22px; height: 22px; border-radius: 7px; background: rgba(255,255,255,.08); color: var(--text); cursor: pointer; font-size: 14px; border: none; }
  .save { padding: 8px 16px; border-radius: 10px; background: var(--acc); color: #fff; font-weight: 700; font-size: 13px; cursor: pointer; border: none; margin-left: auto; }

  .docs { display: flex; flex-direction: column; gap: 12px; }
  .drow { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
  .dsub { font-size: 12.5px; color: var(--muted); margin-top: 3px; max-width: 46ch; }
  .uploader { padding: 9px 15px; border-radius: 11px; background: var(--acc); color: #fff; font-weight: 700; font-size: 13px; cursor: pointer; white-space: nowrap; }
  .uploader.busy { opacity: .6; cursor: default; }
  .cap { font-size: 12.5px; color: var(--text-2, var(--muted)); background: rgba(255,255,255,.04); border: 1px solid var(--line, rgba(255,255,255,.08)); border-radius: 10px; padding: 10px 12px; }
  .cap b { color: var(--text); font-weight: 700; }

  .filters { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; align-items: center; }
  .people { display: flex; gap: 6px; flex-wrap: wrap; }
  .pchip { display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: 999px; background: rgba(255,255,255,.05); border: 1px solid var(--line, rgba(255,255,255,.1)); color: var(--text-2, var(--muted)); font-size: 12px; font-weight: 600; cursor: pointer; }
  .pchip.on { background: var(--soft, rgba(255,255,255,.12)); color: var(--text); border-color: var(--acc); }

  .sec { margin: 6px 2px 0; } .sl { font-size: 11.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); }
  .list { display: flex; flex-direction: column; gap: 8px; }
  .it { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 13px; background: var(--card, rgba(255,255,255,.04)); border: 1px solid var(--line, rgba(255,255,255,.08)); }
  .it.done, .it.paid { opacity: .55; } .it.done .t { text-decoration: line-through; }
  .chk { width: 26px; height: 26px; border-radius: 8px; border: 2px solid var(--line, rgba(255,255,255,.2)); background: transparent; cursor: pointer; flex: none; color: #fff; font-size: 15px; font-weight: 800; display: grid; place-items: center; }
  .chk.ck { background: #009E73; border-color: #009E73; }
  .body { flex: 1; min-width: 0; } .t { font-size: 14.5px; font-weight: 600; } .qty { color: var(--muted); font-weight: 400; }
  .meta { display: flex; align-items: center; gap: 7px; margin-top: 5px; flex-wrap: wrap; }
  .mn { font-size: 11.5px; color: var(--muted); }
  .chip { font-size: 11px; font-weight: 700; color: var(--text-2, var(--muted)); background: rgba(255,255,255,.06); border-radius: 7px; padding: 2px 7px; }
  .chip.due { color: var(--acc); } .chip.due.over { color: #E69F00; background: color-mix(in srgb, #E69F00 15%, transparent); }
  .chip.ok { color: #009E73; }
  .amt { font-size: 14.5px; font-weight: 800; font-variant-numeric: tabular-nums; }
  .del { color: var(--muted); font-size: 13px; cursor: pointer; background: transparent; border: none; padding: 6px; flex: none; }
  .del:hover { color: #E69F00; }

  /* money */
  .cost3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .cc { text-align: center; padding: 12px; border-radius: 12px; background: rgba(255,255,255,.035); }
  .cv { font-size: 20px; font-weight: 800; font-variant-numeric: tabular-nums; } .ck { font-size: 10.5px; color: var(--muted); margin-top: 3px; text-transform: uppercase; letter-spacing: .03em; }
  .bud { margin-top: 12px; } .budtrack { height: 9px; border-radius: 999px; background: rgba(255,255,255,.08); overflow: hidden; }
  .budfill { height: 100%; background: var(--acc); border-radius: 999px; } .budfill.over { background: #E69F00; }
  .budlbl { font-size: 11.5px; color: var(--muted); margin-top: 6px; }
  .tiles3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .tt { padding: 14px; border-radius: 14px; background: var(--card, rgba(255,255,255,.04)); border: 1px solid var(--line, rgba(255,255,255,.08)); text-align: center; }
  .tv { font-size: 19px; font-weight: 800; font-variant-numeric: tabular-nums; } .tk { font-size: 10.5px; color: var(--muted); margin-top: 3px; }
  .cats { display: flex; flex-direction: column; gap: 9px; }
  .crow { display: grid; grid-template-columns: 92px 1fr auto; align-items: center; gap: 10px; }
  .cname { font-size: 12.5px; font-weight: 600; }
  .ctrack { height: 8px; border-radius: 999px; background: rgba(255,255,255,.08); overflow: hidden; }
  .cfill { height: 100%; background: var(--acc); border-radius: 999px; }
  .camt { font-size: 13px; font-weight: 700; font-variant-numeric: tabular-nums; min-width: 56px; text-align: right; }

  /* meals */
  .meals { display: grid; grid-template-columns: 1fr; gap: 8px; }
  .mday { display: grid; grid-template-columns: 44px 1fr; align-items: center; gap: 10px; }
  .mdl { font-size: 12px; font-weight: 700; color: var(--muted); }
  .mday input { padding: 8px 11px; border-radius: 9px; background: rgba(255,255,255,.05); border: 1px solid var(--line, rgba(255,255,255,.1)); color: var(--text); font-size: 13px; width: 100%; }

  .mhint { font-size: 11.5px; color: var(--muted); margin-top: 10px; }

  /* journal */
  .jintro .dsub { margin-top: 4px; max-width: 60ch; }
  .jlist { display: flex; flex-direction: column; gap: 8px; }
  .jentry { padding: 14px 16px; border-radius: 14px; background: var(--card, rgba(255,255,255,.04)); border: 1px solid var(--line, rgba(255,255,255,.08)); border-left: 3px solid var(--acc); }
  .jdate { font-size: 11.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .03em; color: var(--muted); margin-bottom: 6px; }
  .jtext { font-size: 14px; line-height: 1.55; color: var(--text); }

  .foot { font-size: 11.5px; color: var(--muted); margin: 4px 0 0; }
</style>
