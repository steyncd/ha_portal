<script lang="ts">
  import { onMount } from "svelte";
  import { ha } from "../lib/store.svelte";
  import { prefs } from "../lib/prefs.svelte";
  import { toast } from "../lib/toast.svelte";
  import { trello, type TrelloBoard, type TrelloList, type TrelloCard } from "../lib/trello";
  import Icon from "../lib/components/Icon.svelte";

  import Skeleton from "../lib/components/Skeleton.svelte";
  let boards = $state<TrelloBoard[]>([]);
  let lists = $state<TrelloList[]>([]);
  let boardId = $state<string>(prefs.trelloBoard || "");
  let loading = $state(true);
  let refreshing = $state(false);
  let error = $state<string>("");
  let configuring = $state(false);
  let busy = $state<Record<string, boolean>>({}); // per-card action lock
  let adding = $state<string>(""); // listId currently showing the add-card input
  let addText = $state<string>("");
  let moveFor = $state<string>(""); // cardId whose move-menu is open

  // ---- HA count sensors (the ha-trello integration is counts-only) ----
  // Any sensor reporting a "Cards" unit is a Trello list counter; match to a
  // list by name so we can show the live HA count as a small badge.
  const haCounts = $derived.by(() => {
    const out: { name: string; count: number }[] = [];
    for (const [id, e] of Object.entries(ha.entities)) {
      if (!id.startsWith("sensor.")) continue;
      if ((e.attributes?.unit_of_measurement as string) !== "Cards") continue;
      const n = Number(e.state);
      if (Number.isFinite(n)) out.push({ name: String(e.attributes?.friendly_name ?? id).toLowerCase(), count: n });
    }
    return out;
  });
  function haCountFor(listName: string): number | null {
    const ln = listName.toLowerCase().trim();
    const m = haCounts.find((c) => c.name === ln || c.name.endsWith(" " + ln) || c.name.includes(ln));
    return m ? m.count : null;
  }

  // ---- data ----
  async function loadBoards() {
    boards = await trello.boards();
    if (!boardId || !boards.some((b) => b.id === boardId)) boardId = boards[0]?.id ?? "";
  }
  async function loadBoard() {
    if (!boardId) { lists = []; return; }
    const raw = await trello.board(boardId);
    lists = raw.sort((a, b) => (a.pos ?? 0) - (b.pos ?? 0));
  }
  async function loadAll() {
    loading = true; error = "";
    try { await loadBoards(); await loadBoard(); }
    catch (e) { error = e instanceof Error ? e.message : String(e); }
    finally { loading = false; }
  }
  async function refresh() {
    refreshing = true;
    try { await loadBoard(); } catch (e) { toast.show(e instanceof Error ? e.message : "Refresh failed"); }
    finally { refreshing = false; }
  }
  onMount(loadAll);

  async function switchBoard(id: string) {
    boardId = id; prefs.trelloBoard = id; prefs.save();
    refreshing = true;
    try { await loadBoard(); } catch (e) { error = e instanceof Error ? e.message : String(e); }
    finally { refreshing = false; }
  }

  // ---- which lists are shown (per-device config) ----
  function listShown(l: TrelloList): boolean {
    const v = prefs.trelloLists[l.id];
    return v === undefined ? true : v; // default: show
  }
  function toggleList(l: TrelloList) {
    prefs.trelloLists = { ...prefs.trelloLists, [l.id]: !listShown(l) };
    prefs.save();
  }
  const shownLists = $derived(lists.filter(listShown));

  // ---- card actions ----
  const setBusy = (id: string, v: boolean) => (busy = { ...busy, [id]: v });
  async function act(cardId: string, fn: () => Promise<unknown>, okMsg?: string) {
    setBusy(cardId, true);
    try { await fn(); await loadBoard(); if (okMsg) toast.show(okMsg); }
    catch (e) { toast.show(e instanceof Error ? e.message : "Action failed"); }
    finally { setBusy(cardId, false); moveFor = ""; }
  }
  const complete = (c: TrelloCard) => act(c.id, () => trello.setComplete(c.id, !c.dueComplete));
  const archive = (c: TrelloCard) => act(c.id, () => trello.archive(c.id), "Card archived");
  const move = (c: TrelloCard, destListId: string) => act(c.id, () => trello.moveCard(c.id, destListId, "top"));

  async function addCard(listId: string) {
    const name = addText.trim();
    if (!name) { adding = ""; return; }
    addText = "";
    try { await trello.createCard(listId, name); await loadBoard(); }
    catch (e) { toast.show(e instanceof Error ? e.message : "Couldn't add card"); }
  }

  // ---- labels / due ----
  const LABEL_COLORS: Record<string, string> = {
    green: "#22c55e", yellow: "#eab308", orange: "#f97316", red: "#ef4444",
    purple: "#a855f7", blue: "#3b82f6", sky: "#0ea5e9", lime: "#84cc16",
    pink: "#ec4899", black: "#64748b",
  };
  function dueInfo(c: TrelloCard): { label: string; cls: string } | null {
    if (!c.due) return null;
    const d = new Date(c.due), now = new Date();
    const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
    const label = d.toLocaleDateString(undefined, opts);
    if (c.dueComplete) return { label, cls: "done" };
    if (d.getTime() < now.getTime()) return { label, cls: "over" };
    if (d.getTime() - now.getTime() < 36 * 3600_000) return { label, cls: "soon" };
    return { label, cls: "" };
  }
</script>

<div class="wrap">
  {#if loading}
    <div class="vload"><Skeleton variant="lines" lines={5} /></div>
  {:else if error}
    <div class="card pad setup">
      <strong>Trello isn't connected yet</strong>
      <p>{error}</p>
      <p class="hint">This page reads your boards through a secure proxy. An admin needs to set the Trello <code>TRELLO_KEY</code> and <code>TRELLO_TOKEN</code> (from Trello's Power-Up Admin Portal) in the portal's Cloud Functions secrets. Once set, your boards appear here.</p>
      <button class="chip" onclick={loadAll}>Retry</button>
    </div>
  {:else}
    <!-- toolbar -->
    <div class="tbar">
      <select class="bsel" value={boardId} onchange={(e) => switchBoard((e.target as HTMLSelectElement).value)}>
        {#each boards as b (b.id)}<option value={b.id}>{b.name}</option>{/each}
      </select>
      <div class="tspacer"></div>
      <button class="chip" class:spin={refreshing} onclick={refresh} title="Refresh">↻ Refresh</button>
      <button class="chip" class:on={configuring} onclick={() => (configuring = !configuring)} title="Choose lists"><Icon name="gear" size={14} /> Lists</button>
    </div>

    {#if configuring}
      <div class="card pad cfg">
        <div class="cfgh">Show these lists</div>
        <div class="cfggrid">
          {#each lists as l (l.id)}
            <label class="cfgrow"><input type="checkbox" checked={listShown(l)} onchange={() => toggleList(l)} /> {l.name} <span class="ct">{l.cards?.length ?? 0}</span></label>
          {/each}
        </div>
        <p class="hint">Choices are saved on this device.</p>
      </div>
    {/if}

    {#if !shownLists.length}
      <div class="card pad empty">No lists to show. {lists.length ? "Enable some under “Lists”." : "This board has no open lists."}</div>
    {:else}
      <div class="board">
        {#each shownLists as l (l.id)}
          {@const haN = haCountFor(l.name)}
          <section class="col">
            <div class="colh">
              <span class="cn">{l.name}</span>
              <span class="cc">{l.cards?.length ?? 0}</span>
              {#if haN != null}<span class="hac" title="Live count from the Home Assistant Trello integration">HA {haN}</span>{/if}
            </div>
            <div class="cards">
              {#each l.cards ?? [] as c (c.id)}
                {@const due = dueInfo(c)}
                <article class="tc" class:busy={busy[c.id]} class:cdone={c.dueComplete}>
                  <div class="tct">
                    <button class="cbx" class:ck={c.dueComplete} onclick={() => complete(c)} title={c.dueComplete ? "Mark not complete" : "Mark complete"} aria-label="Toggle complete">{c.dueComplete ? "✓" : ""}</button>
                    <a class="cname" href={c.shortUrl} target="_blank" rel="noopener">{c.name}</a>
                  </div>
                  {#if (c.labels && c.labels.length) || due}
                    <div class="cmeta">
                      {#each c.labels ?? [] as lb}
                        <span class="lbl" style="background:{LABEL_COLORS[lb.color ?? 'black'] ?? '#64748b'}">{lb.name || ""}</span>
                      {/each}
                      {#if due}<span class="due {due.cls}">🗓 {due.label}</span>{/if}
                    </div>
                  {/if}
                  <div class="cact">
                    <div class="movewrap">
                      <button class="mini" onclick={() => (moveFor = moveFor === c.id ? "" : c.id)} title="Move">→ Move</button>
                      {#if moveFor === c.id}
                        <div class="movemenu">
                          {#each lists.filter((x) => x.id !== l.id) as dl (dl.id)}
                            <button onclick={() => move(c, dl.id)}>{dl.name}</button>
                          {/each}
                        </div>
                      {/if}
                    </div>
                    <button class="mini danger" onclick={() => archive(c)} title="Archive">Archive</button>
                  </div>
                </article>
              {/each}
            </div>
            {#if adding === l.id}
              <div class="addbox">
                <!-- svelte-ignore a11y_autofocus -->
                <textarea autofocus bind:value={addText} placeholder="Card title…" onkeydown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addCard(l.id); } if (e.key === "Escape") { adding = ""; addText = ""; } }}></textarea>
                <div class="addrow"><button class="chip primary" onclick={() => addCard(l.id)}>Add</button><button class="chip" onclick={() => { adding = ""; addText = ""; }}>Cancel</button></div>
              </div>
            {:else}
              <button class="addbtn" onclick={() => { adding = l.id; addText = ""; }}>＋ Add a card</button>
            {/if}
          </section>
        {/each}
      </div>
    {/if}
  {/if}
</div>

<style>
  .wrap { display: flex; flex-direction: column; gap: 0.9rem; }
  .tbar { display: flex; align-items: center; gap: 0.5rem; }
  .tspacer { flex: 1; }
  .bsel {
    background: var(--card, rgba(255,255,255,0.05)); color: var(--text, #eef2f9);
    border: 1px solid var(--line, rgba(255,255,255,0.12)); border-radius: 10px;
    padding: 0.5rem 0.7rem; font: inherit; font-weight: 600; max-width: 60vw;
  }
  .chip.on, .chip.primary { background: var(--acc); color: #08121a; border-color: transparent; font-weight: 700; }
  .chip.spin { opacity: 0.6; }

  .cfg .cfgh { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted, #93a3b5); margin-bottom: 0.5rem; }
  .cfggrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 0.4rem 1rem; }
  .cfgrow { display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem; cursor: pointer; }
  .cfgrow input { width: 16px; height: 16px; accent-color: var(--acc); }
  .cfgrow .ct { margin-left: auto; color: var(--muted, #93a3b5); font-size: 0.78rem; }

  .board { display: flex; gap: 0.9rem; overflow-x: auto; padding-bottom: 0.6rem; scroll-snap-type: x proximity; }
  .col {
    flex: 0 0 clamp(240px, 78vw, 300px); scroll-snap-align: start;
    background: color-mix(in srgb, var(--card, #ffffff0d) 60%, transparent);
    border: 1px solid var(--line, rgba(255,255,255,0.10)); border-radius: 14px;
    display: flex; flex-direction: column; max-height: calc(100vh - 220px);
  }
  .colh { display: flex; align-items: center; gap: 0.5rem; padding: 0.7rem 0.8rem 0.5rem; }
  .colh .cn { font-weight: 700; font-size: 0.95rem; }
  .colh .cc { background: var(--line, rgba(255,255,255,0.12)); color: var(--muted, #cdd6e4); border-radius: 999px; font-size: 0.72rem; padding: 0.05rem 0.45rem; font-weight: 700; }
  .colh .hac { margin-left: auto; font-size: 0.64rem; color: var(--acc); border: 1px solid color-mix(in srgb, var(--acc) 40%, transparent); border-radius: 6px; padding: 0.05rem 0.35rem; }

  .cards { display: flex; flex-direction: column; gap: 0.5rem; padding: 0 0.6rem; overflow-y: auto; }
  .tc { background: var(--card, rgba(255,255,255,0.05)); border: 1px solid var(--line, rgba(255,255,255,0.10)); border-radius: 11px; padding: 0.55rem 0.6rem; transition: opacity 0.15s; }
  .tc.busy { opacity: 0.5; pointer-events: none; }
  .tc.cdone .cname { text-decoration: line-through; color: var(--muted, #93a3b5); }
  .tct { display: flex; gap: 0.5rem; align-items: flex-start; }
  .cbx { flex-shrink: 0; width: 18px; height: 18px; border-radius: 6px; border: 1.5px solid var(--line, rgba(255,255,255,0.3)); background: none; color: var(--acc); font-size: 0.72rem; line-height: 1; cursor: pointer; margin-top: 0.1rem; }
  .cbx.ck { background: var(--acc); color: #08121a; border-color: transparent; }
  .cname { font-size: 0.88rem; line-height: 1.3; color: var(--text, #eef2f9); text-decoration: none; word-break: break-word; }
  .cname:hover { text-decoration: underline; }
  .cmeta { display: flex; flex-wrap: wrap; gap: 0.3rem; margin: 0.45rem 0 0 1.6rem; }
  .lbl { font-size: 0.64rem; font-weight: 700; color: #fff; border-radius: 5px; padding: 0.08rem 0.4rem; line-height: 1.4; }
  .due { font-size: 0.66rem; font-weight: 600; border-radius: 5px; padding: 0.08rem 0.4rem; background: var(--line, rgba(255,255,255,0.1)); color: var(--muted, #cdd6e4); }
  .due.over { background: color-mix(in srgb, #ef4444 22%, transparent); color: #fca5a5; }
  .due.soon { background: color-mix(in srgb, #eab308 22%, transparent); color: #fde047; }
  .due.done { background: color-mix(in srgb, #22c55e 22%, transparent); color: #86efac; }
  .cact { display: flex; gap: 0.4rem; margin: 0.5rem 0 0 1.6rem; }
  .mini { font-size: 0.7rem; font-weight: 600; color: var(--muted, #93a3b5); background: none; border: 1px solid var(--line, rgba(255,255,255,0.12)); border-radius: 7px; padding: 0.2rem 0.45rem; cursor: pointer; }
  .mini:hover { color: var(--text, #fff); }
  .mini.danger:hover { color: #fca5a5; border-color: #ef4444; }
  .movewrap { position: relative; }
  .movemenu { position: absolute; top: 100%; left: 0; z-index: 20; margin-top: 0.25rem; background: var(--bg2, #0f1622); border: 1px solid var(--line, rgba(255,255,255,0.14)); border-radius: 10px; padding: 0.25rem; box-shadow: 0 12px 30px rgba(0,0,0,0.5); max-height: 220px; overflow-y: auto; min-width: 150px; }
  .movemenu button { display: block; width: 100%; text-align: left; background: none; border: none; color: var(--text, #eef2f9); font: inherit; font-size: 0.8rem; padding: 0.4rem 0.55rem; border-radius: 7px; cursor: pointer; }
  .movemenu button:hover { background: var(--line, rgba(255,255,255,0.1)); }

  .addbtn { margin: 0.5rem 0.6rem 0.7rem; background: none; border: 1px dashed var(--line, rgba(255,255,255,0.15)); color: var(--muted, #93a3b5); border-radius: 10px; padding: 0.5rem; font: inherit; font-size: 0.82rem; cursor: pointer; text-align: left; }
  .addbtn:hover { color: var(--text, #fff); border-color: var(--acc); }
  .addbox { padding: 0.5rem 0.6rem 0.7rem; }
  .addbox textarea { width: 100%; min-height: 54px; resize: vertical; background: var(--card, rgba(255,255,255,0.06)); color: var(--text, #eef2f9); border: 1px solid var(--line, rgba(255,255,255,0.14)); border-radius: 9px; padding: 0.5rem; font: inherit; font-size: 0.85rem; }
  .addrow { display: flex; gap: 0.4rem; margin-top: 0.4rem; }

  .setup strong { display: block; margin-bottom: 0.3rem; }
  .setup .hint, .cfg .hint { color: var(--muted, #93a3b5); font-size: 0.82rem; }
  .setup code { background: var(--line, rgba(255,255,255,0.1)); padding: 0.05rem 0.3rem; border-radius: 5px; }
  .empty { color: var(--muted, #93a3b5); }
  .vload { display: grid; place-items: center; padding: 3rem; }
  .spinner { width: 28px; height: 28px; border: 3px solid var(--line, rgba(255,255,255,0.15)); border-top-color: var(--acc); border-radius: 50%; animation: sp 0.8s linear infinite; }
  @keyframes sp { to { transform: rotate(360deg); } }
</style>
