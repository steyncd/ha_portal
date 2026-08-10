<script lang="ts">
  // Faith — daily verse + family-devotion prompt, the living Gebedslys prayer
  // board (pray-today streaks + answered archive), and the boys' memory verses.
  import { onMount } from "svelte";
  import { verseOfDay, promptOfDay } from "../lib/devotion";
  import {
    watchPrayers, addPrayer, togglePrayedToday, setAnswered, removePrayer,
    watchMemory, setMemory, streak, prayedToday,
    watchGratitude, addGratitude, gratitudeTodayKey,
    type Prayer, type MemoryDoc, type MemoryVerse, type Gratitude,
  } from "../lib/faith";
  import { sabbath } from "../lib/sabbath.svelte";
  import { toast } from "../lib/toast.svelte";

  const isMock = typeof location !== "undefined" && new URLSearchParams(location.search).get("mock") === "1";
  const verse = verseOfDay();
  const prompt = promptOfDay();

  const KIDS = [
    { slug: "liam", name: "Liam", icon: "🧒" },
    { slug: "eben", name: "Eben", icon: "👦" },
  ];
  const STATUS: { key: MemoryVerse["status"]; label: string; color: string }[] = [
    { key: "learning", label: "Learning", color: "var(--warning)" },
    { key: "reviewing", label: "Reviewing", color: "var(--acc)" },
    { key: "known", label: "Known", color: "var(--success)" },
  ];

  const FAMILY = ["Christo", "Mandri", "Liam", "Eben"];
  let prayers = $state<Prayer[]>([]);
  let memory = $state<MemoryDoc>({});
  let gratitude = $state<Gratitude[]>([]);
  let gWho = $state("Christo");
  let gText = $state("");
  let newText = $state("");
  let showAnswered = $state(false);
  let editKid = $state<string | null>(null);
  let draft = $state<MemoryVerse>({ ref: "", text: "", status: "learning" });
  const sabbathOn = $derived(sabbath.on);

  onMount(() => {
    if (isMock) {
      prayers = [
        { id: "1", text: "Ouma se gesondheid", category: "Familie", answered: false, prayedDates: [new Date(Date.now() + 2 * 3600_000).toISOString().slice(0, 10)] },
        { id: "2", text: "Wysheid vir die skool jaar", category: "Kinders", answered: false, prayedDates: [] },
        { id: "3", text: "Nuwe werk vir oom Piet", category: "Vriende", answered: true, answeredAt: Date.now() - 5 * 86400_000, prayedDates: [] },
      ];
      memory = {
        liam: { ref: "Psalm 23:1", text: "Yahweh is my shepherd; I shall lack nothing.", status: "reviewing" },
        eben: { ref: "John 3:16", text: "For God so loved the world…", status: "learning" },
      };
      gratitude = [
        { id: "1", who: "Liam", text: "A sunny day to play outside", date: gratitudeTodayKey() },
        { id: "2", who: "Mandri", text: "Coffee on the patio this morning", date: gratitudeTodayKey() },
      ];
      return;
    }
    const u1 = watchPrayers((p) => (prayers = p.sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0))));
    const u2 = watchMemory((m) => (memory = m));
    const u3 = watchGratitude((g) => (gratitude = g));
    return () => { u1(); u2(); u3(); };
  });

  async function addG() {
    const t = gText.trim(); if (!t) return;
    if (isMock) { gratitude = [{ id: String(Date.now()), who: gWho, text: t, date: gratitudeTodayKey() }, ...gratitude]; gText = ""; return; }
    try { await addGratitude(gWho, t); gText = ""; } catch (e) { toast.show(e instanceof Error ? e.message : String(e)); }
  }
  const gToday = $derived(gratitude.filter((g) => g.date === gratitudeTodayKey()));

  const active = $derived(prayers.filter((p) => !p.answered));
  const answered = $derived(prayers.filter((p) => p.answered).sort((a, b) => (b.answeredAt ?? 0) - (a.answeredAt ?? 0)));

  async function add() {
    const t = newText.trim();
    if (!t) return;
    if (isMock) { prayers = [...prayers, { id: String(Date.now()), text: t, answered: false, prayedDates: [] }]; newText = ""; return; }
    try { await addPrayer(t); newText = ""; } catch (e) { toast.show(e instanceof Error ? e.message : String(e)); }
  }
  async function prayed(p: Prayer) {
    if (isMock) { const k = new Date(Date.now() + 2 * 3600_000).toISOString().slice(0, 10); const has = (p.prayedDates ?? []).includes(k); prayers = prayers.map((x) => x.id === p.id ? { ...x, prayedDates: has ? (x.prayedDates ?? []).filter((d) => d !== k) : [...(x.prayedDates ?? []), k] } : x); return; }
    await togglePrayedToday(p);
  }
  async function answer(p: Prayer, val: boolean) {
    if (isMock) { prayers = prayers.map((x) => x.id === p.id ? { ...x, answered: val, answeredAt: val ? Date.now() : null } : x); if (val) toast.show("Answered — praise God! 🙏"); return; }
    await setAnswered(p.id, val); if (val) toast.show("Answered — praise God! 🙏");
  }
  async function remove(p: Prayer) {
    if (isMock) { prayers = prayers.filter((x) => x.id !== p.id); return; }
    await removePrayer(p.id);
  }
  function startEdit(slug: string) {
    editKid = slug;
    draft = { ...(memory[slug] ?? { ref: "", text: "", status: "learning" }) };
  }
  async function saveEdit(slug: string) {
    if (isMock) { memory = { ...memory, [slug]: { ...draft } }; editKid = null; return; }
    try { await setMemory(slug, draft); editKid = null; toast.show("Saved"); } catch (e) { toast.show(e instanceof Error ? e.message : String(e)); }
  }
  const fmtDate = (ms?: number | null) => (ms ? new Date(ms).toLocaleDateString("en-ZA", { day: "numeric", month: "short" }) : "");
</script>

<div class="col">
  <div class="hdr">
    <div><h2>Faith</h2><p>A verse for the day, our prayers, and the boys' memory work.</p></div>
    <button class="sabbath" class:on={sabbathOn} onclick={() => sabbath.toggle()}>
      <span class="sic">{sabbathOn ? "🕯️" : "🌙"}</span>{sabbathOn ? "Sabbath on" : "Sabbath mode"}
    </button>
  </div>

  {#if sabbathOn}
    <div class="card restbanner">
      <span class="ri">🕊️</span>
      <div><div class="rt">The Lord's day — rest &amp; worship</div><div class="rs">Work, admin and money screens are tucked away. Be still.</div></div>
    </div>
  {/if}

  <!-- verse + devotion -->
  <div class="two">
    <div class="card verse">
      <span class="glow"></span>
      <div class="lb">Verse of the day</div>
      <div class="vt">“{verse.text}”</div>
      <div class="vr">— {verse.ref}</div>
    </div>
    <div class="card">
      <div class="lb">Family devotion</div>
      <div class="prompt">{prompt}</div>
      <div class="note">A question to talk through together tonight.</div>
    </div>
  </div>

  <!-- prayer board -->
  <div class="card">
    <div class="rh"><span class="lb">🙏 Gebedslys · prayer board</span><span class="sub">{active.length} active · {answered.length} answered</span></div>
    <form class="addrow" onsubmit={(e) => { e.preventDefault(); add(); }}>
      <input bind:value={newText} placeholder="Add a prayer request…" />
      <button class="addbtn" type="submit">Add</button>
    </form>

    <div class="plist">
      {#each active as p (p.id)}
        {@const s = streak(p.prayedDates)}
        {@const pt = prayedToday(p)}
        <div class="prow">
          <button class="pray" class:on={pt} onclick={() => prayed(p)} title="Prayed today">{pt ? "🙏" : "🤲"}</button>
          <div class="ptxt">
            <div class="pt">{p.text}</div>
            <div class="ps">{p.category ? p.category + " · " : ""}{s > 0 ? `prayed ${s} day${s === 1 ? "" : "s"} in a row` : "not yet this streak"}</div>
          </div>
          <button class="ans" onclick={() => answer(p, true)} title="Mark answered">✓ Answered</button>
          <button class="del" onclick={() => remove(p)} aria-label="Remove">✕</button>
        </div>
      {/each}
      {#if active.length === 0}<div class="empty">No active prayers — add one above.</div>{/if}
    </div>

    {#if answered.length}
      <button class="arctog" onclick={() => (showAnswered = !showAnswered)}>{showAnswered ? "▾" : "▸"} Answered prayers ({answered.length})</button>
      {#if showAnswered}
        <div class="arc">
          {#each answered as p (p.id)}
            <div class="arow">
              <span class="ac">✓</span>
              <span class="at">{p.text}</span>
              <span class="ad">{fmtDate(p.answeredAt)}</span>
              <button class="reopen" onclick={() => answer(p, false)}>Reopen</button>
            </div>
          {/each}
        </div>
      {/if}
    {/if}
  </div>

  <!-- gratitude journal -->
  <div class="card">
    <div class="rh"><span class="lb">🙌 Gratitude</span><span class="sub">{gToday.length} today</span></div>
    <form class="graddrow" onsubmit={(e) => { e.preventDefault(); addG(); }}>
      <select bind:value={gWho}>{#each FAMILY as f}<option value={f}>{f}</option>{/each}</select>
      <input bind:value={gText} placeholder="One thing you're thankful for today…" />
      <button class="addbtn" type="submit">Add</button>
    </form>
    <div class="glist">
      {#each gratitude.slice(0, 12) as g (g.id)}
        <div class="grow"><span class="gwho">{g.who}</span><span class="gtext">{g.text}</span>{#if g.date !== gratitudeTodayKey()}<span class="gdate">{g.date.slice(5)}</span>{/if}</div>
      {/each}
      {#if gratitude.length === 0}<div class="empty">No entries yet — start tonight.</div>{/if}
    </div>
  </div>

  <!-- memory verses -->
  <div class="card">
    <div class="lb" style="margin-bottom:12px">📖 Memory verses</div>
    <div class="kids">
      {#each KIDS as k (k.slug)}
        {@const mv = memory[k.slug]}
        <div class="kid">
          <div class="kh"><span class="ki">{k.icon}</span><span class="kn">{k.name}</span>
            {#if mv}<span class="badge" style="color:{STATUS.find((s) => s.key === mv.status)?.color};background:color-mix(in srgb,{STATUS.find((s) => s.key === mv.status)?.color} 15%,transparent)">{STATUS.find((s) => s.key === mv.status)?.label}</span>{/if}
            <button class="editbtn" onclick={() => (editKid === k.slug ? (editKid = null) : startEdit(k.slug))}>{editKid === k.slug ? "Cancel" : mv ? "Edit" : "Set verse"}</button>
          </div>
          {#if editKid === k.slug}
            <div class="edit">
              <input bind:value={draft.ref} placeholder="Reference (e.g. Psalm 23:1)" />
              <textarea bind:value={draft.text} rows="2" placeholder="Verse text"></textarea>
              <div class="statusrow">
                {#each STATUS as s}
                  <button class="stbtn" class:sel={draft.status === s.key} style="--sc:{s.color}" onclick={() => (draft.status = s.key)}>{s.label}</button>
                {/each}
              </div>
              <button class="save" onclick={() => saveEdit(k.slug)}>Save</button>
            </div>
          {:else if mv}
            <div class="mv"><div class="mvr">{mv.ref}</div><div class="mvt">“{mv.text}”</div></div>
          {:else}
            <div class="empty">No verse set yet.</div>
          {/if}
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  .col { display: flex; flex-direction: column; gap: 14px; }
  .hdr { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; }
  .hdr h2 { font-size: 20px; font-weight: 800; margin: 0; }
  .hdr p { font-size: 12.5px; color: var(--muted); margin: 4px 0 0; }
  .sabbath { display: flex; align-items: center; gap: 8px; padding: 9px 15px; border-radius: 12px; background: rgba(255,255,255,0.05); color: var(--text-2); font-size: 13px; font-weight: 600; flex: none; }
  .sabbath:hover { background: rgba(255,255,255,0.09); color: var(--text); }
  .sabbath.on { background: color-mix(in srgb, var(--acc) 18%, transparent); color: var(--acc); box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--acc) 40%, transparent); }
  .sic { font-size: 15px; }
  .restbanner { display: flex; align-items: center; gap: 14px; background: color-mix(in srgb, var(--acc) 8%, transparent); }
  .ri { font-size: 26px; }
  .rt { font-size: 14.5px; font-weight: 700; }
  .rs { font-size: 12px; color: var(--muted); margin-top: 2px; }
  .graddrow { display: flex; gap: 8px; margin: 12px 0 14px; }
  .graddrow select { padding: 10px 12px; border-radius: 11px; background: rgba(255,255,255,0.05); border: 1px solid var(--line, rgba(255,255,255,0.08)); color: var(--text); font-size: 13px; flex: none; }
  .graddrow input { flex: 1; padding: 10px 13px; border-radius: 11px; background: rgba(255,255,255,0.05); border: 1px solid var(--line, rgba(255,255,255,0.08)); color: var(--text); font-size: 13px; }
  .glist { display: flex; flex-direction: column; gap: 6px; }
  .grow { display: flex; align-items: baseline; gap: 11px; padding: 9px 12px; border-radius: 10px; background: rgba(255,255,255,0.03); }
  .gwho { font-size: 11.5px; font-weight: 800; color: var(--acc2, var(--acc)); flex: none; width: 60px; }
  .gtext { flex: 1; min-width: 0; font-size: 13px; color: var(--text-2); }
  .gdate { font-size: 10.5px; color: var(--muted); }
  .two { display: grid; grid-template-columns: 1.3fr 1fr; gap: 14px; }
  @media (max-width: 720px) { .two { grid-template-columns: 1fr; } }
  .card { position: relative; background: var(--card, rgba(255,255,255,0.04)); border: 1px solid var(--line, rgba(255,255,255,0.08)); border-radius: 18px; padding: 18px; overflow: hidden; }
  .lb { font-size: 11px; font-weight: 700; color: var(--muted); }
  .sub { font-size: 12px; color: var(--dim); }
  .rh { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 12px; }

  .verse .glow { position: absolute; inset: 0; background: radial-gradient(120% 80% at 90% -10%, color-mix(in srgb, var(--acc) 18%, transparent), transparent 60%); pointer-events: none; }
  .vt { font-size: 17px; line-height: 1.5; font-weight: 600; margin: 12px 0 8px; text-wrap: balance; }
  .vr { font-size: 13px; color: var(--acc2, var(--acc)); font-weight: 700; }
  .prompt { font-size: 15px; line-height: 1.5; margin: 12px 0 8px; }
  .note { font-size: 11.5px; color: var(--muted); font-style: italic; }

  .addrow { display: flex; gap: 8px; margin: 12px 0 14px; }
  .addrow input { flex: 1; padding: 10px 13px; border-radius: 11px; background: rgba(255,255,255,0.05); border: 1px solid var(--line, rgba(255,255,255,0.08)); color: var(--text); font-size: 13px; }
  .addbtn { padding: 10px 16px; border-radius: 11px; background: var(--grad, var(--acc)); color: #05070c; font-weight: 700; font-size: 13px; }
  .plist { display: flex; flex-direction: column; gap: 8px; }
  .prow { display: flex; align-items: center; gap: 11px; padding: 11px 13px; border-radius: 13px; background: rgba(255,255,255,0.03); }
  .pray { width: 38px; height: 38px; border-radius: 11px; background: rgba(255,255,255,0.06); font-size: 18px; flex: none; }
  .pray.on { background: color-mix(in srgb, var(--acc) 20%, transparent); box-shadow: inset 0 0 0 1.5px var(--acc); }
  .ptxt { flex: 1; min-width: 0; }
  .pt { font-size: 13.5px; font-weight: 600; color: var(--text); }
  .ps { font-size: 11px; color: var(--muted); margin-top: 2px; }
  .ans { font-size: 11.5px; font-weight: 600; color: var(--success); background: color-mix(in srgb, var(--success) 12%, transparent); border-radius: 9px; padding: 7px 10px; flex: none; }
  .ans:hover { background: color-mix(in srgb, var(--success) 20%, transparent); }
  .del { width: 28px; height: 28px; border-radius: 8px; color: var(--muted); font-size: 12px; flex: none; }
  .del:hover { background: rgba(255,255,255,0.08); color: var(--text); }
  .empty { font-size: 12.5px; color: var(--muted); padding: 12px; text-align: center; }
  .arctog { margin-top: 12px; font-size: 12px; font-weight: 600; color: var(--acc2, var(--acc)); }
  .arc { display: flex; flex-direction: column; gap: 6px; margin-top: 8px; }
  .arow { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: 10px; background: color-mix(in srgb, var(--success) 7%, transparent); }
  .ac { color: var(--success); font-weight: 800; }
  .at { flex: 1; min-width: 0; font-size: 12.5px; color: var(--text-2); }
  .ad { font-size: 11px; color: var(--muted); }
  .reopen { font-size: 11px; color: var(--muted); }
  .reopen:hover { color: var(--text); }

  .kids { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  @media (max-width: 640px) { .kids { grid-template-columns: 1fr; } }
  .kid { padding: 14px; border-radius: 14px; background: rgba(255,255,255,0.03); box-shadow: inset 0 0 0 1px var(--line, rgba(255,255,255,0.06)); }
  .kh { display: flex; align-items: center; gap: 9px; margin-bottom: 10px; }
  .ki { font-size: 18px; } .kn { font-size: 14px; font-weight: 700; flex: 1; }
  .badge { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; padding: 3px 8px; border-radius: 999px; }
  .editbtn { font-size: 11.5px; color: var(--acc2, var(--acc)); font-weight: 600; }
  .mvr { font-size: 13px; font-weight: 700; color: var(--acc2, var(--acc)); margin-bottom: 4px; }
  .mvt { font-size: 13px; line-height: 1.45; color: var(--text-2); }
  .edit { display: flex; flex-direction: column; gap: 8px; }
  .edit input, .edit textarea { padding: 9px 12px; border-radius: 10px; background: rgba(255,255,255,0.05); border: 1px solid var(--line, rgba(255,255,255,0.08)); color: var(--text); font-size: 13px; font-family: inherit; resize: vertical; }
  .statusrow { display: flex; gap: 6px; }
  .stbtn { flex: 1; padding: 7px; border-radius: 9px; font-size: 11.5px; font-weight: 600; background: rgba(255,255,255,0.05); color: var(--text-2); }
  .stbtn.sel { background: color-mix(in srgb, var(--sc) 18%, transparent); color: var(--sc); box-shadow: inset 0 0 0 1.5px var(--sc); }
  .save { padding: 9px; border-radius: 10px; background: var(--grad, var(--acc)); color: #05070c; font-weight: 700; font-size: 12.5px; }
</style>
