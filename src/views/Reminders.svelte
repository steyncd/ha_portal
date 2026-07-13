<script lang="ts">
  import { onMount } from "svelte";
  import { ha, type Reminder } from "../lib/store.svelte";
  import { toast } from "../lib/toast.svelte";
  import Toggle from "../lib/components/Toggle.svelte";

  const SPEAKERS = [
    { id: "media_player.study_speaker", label: "Study Speaker" },
    { id: "media_player.home_group", label: "Whole home" },
  ];
  const RECIPIENTS = [
    { key: "christo", label: "Christo" },
    { key: "mandri", label: "Mandri" },
    { key: "liam_eben", label: "Liam & Eben" },
  ];
  // destinations, in the order shown in the per-destination editor
  const DESTS = [
    { key: "announce", label: "Announcement", icon: "🔊" },
    { key: "push_christo", label: "Push → Christo", icon: "📱" },
    { key: "wa_christo", label: "WhatsApp Christo", icon: "💬" },
    { key: "wa_mandri", label: "WhatsApp Mandri", icon: "💬" },
    { key: "wa_liam_eben", label: "WhatsApp Liam & Eben", icon: "💬" },
  ];
  const WEEKDAYS = [ ["MO", "Mon"], ["TU", "Tue"], ["WE", "Wed"], ["TH", "Thu"], ["FR", "Fri"], ["SA", "Sat"], ["SU", "Sun"] ];

  // ---- message template library (message_templates.json store) ----
  let store = $state<Record<string, Record<string, string>>>({});
  // JSON clone (not structuredClone) — messageTemplates() returns a Svelte $state
  // proxy, which structuredClone cannot copy (it throws).
  function loadStore() { store = JSON.parse(JSON.stringify(ha.messageTemplates() ?? {})); }
  const msgKeys = $derived(Object.keys(store));

  // ---- reminder list ----
  let reminders = $state<Reminder[]>([]);
  let loading = $state(true);
  async function refresh() {
    loading = true;
    const raw = await ha.listReminders(90);
    const byUid = new Map<string, Reminder>();
    for (const e of raw) {
      const key = e.uid ?? e.summary + (e.start?.dateTime ?? "");
      const prev = byUid.get(key);
      if (!prev || (start(e) ?? Infinity) < (start(prev) ?? Infinity)) byUid.set(key, e);
    }
    reminders = [...byUid.values()].sort((a, b) => (start(a) ?? 0) - (start(b) ?? 0));
    loading = false;
  }
  onMount(async () => {
    // entities stream in asynchronously (mock loads via dynamic import) — wait briefly
    for (let i = 0; i < 25 && Object.keys(ha.messageTemplates()).length === 0; i++) await new Promise((r) => setTimeout(r, 120));
    loadStore();
    refresh();
  });

  const start = (r: Reminder) => { const s = r.start?.dateTime ?? r.start?.date; return s ? Date.parse(s) : undefined; };
  function whenLabel(r: Reminder) {
    const t = start(r); if (t == null) return "—";
    const d = new Date(t); const today = new Date(); today.setHours(0, 0, 0, 0);
    const day = new Date(t); day.setHours(0, 0, 0, 0);
    const dd = Math.round((day.getTime() - today.getTime()) / 86_400_000);
    const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    const date = dd === 0 ? "Today" : dd === 1 ? "Tomorrow" : d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
    return `${date} · ${time}`;
  }
  function repeatLabel(r: Reminder) {
    if (!r.rrule) return "Once";
    const m = /FREQ=(\w+)/.exec(r.rrule)?.[1] ?? "";
    if (m === "DAILY") return "Daily";
    if (m === "WEEKLY") { const days = /BYDAY=([^;]+)/.exec(r.rrule)?.[1]; return days ? `Weekly · ${days.replace(/,/g, " ")}` : "Weekly"; }
    if (m === "MONTHLY") return "Monthly";
    return "Repeats";
  }
  function parseCfg(r: Reminder) { try { return (r.description ?? "").trim().startsWith("{") ? JSON.parse(r.description!) : {}; } catch { return {}; } }
  function destChips(r: Reminder) {
    const c = parseCfg(r); const out: string[] = [];
    if (c.announce) out.push("🔊");
    if (c.push) out.push("📱");
    (c.wa ?? []).forEach((w: string) => out.push(RECIPIENTS.find((x) => x.key === w)?.label ?? w));
    return out;
  }

  // ---- builder ----
  let building = $state(false);
  let editingUid = $state<string | null>(null);
  let f = $state(newForm());
  function newForm() {
    const d = new Date(Date.now() + 3_600_000); d.setSeconds(0, 0);
    return {
      title: "", useTemplate: false, template: "", msg: "",
      when: toLocalInput(d), repeat: "none" as "none" | "daily" | "weekly" | "monthly", days: [] as string[],
      announce: true, speaker: "media_player.study_speaker", push: false,
      wa: { christo: false, mandri: false, liam_eben: false } as Record<string, boolean>,
    };
  }
  function toLocalInput(d: Date) {
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  }
  function openNew() { editingUid = null; f = newForm(); building = true; preview = ""; }
  function openEdit(r: Reminder) {
    const c = parseCfg(r); const d = start(r) ? new Date(start(r)!) : new Date();
    f = {
      title: r.summary, useTemplate: !!c.template, template: c.template ?? "", msg: c.msg ?? "",
      when: toLocalInput(d),
      repeat: r.rrule?.includes("DAILY") ? "daily" : r.rrule?.includes("WEEKLY") ? "weekly" : r.rrule?.includes("MONTHLY") ? "monthly" : "none",
      days: (/BYDAY=([^;]+)/.exec(r.rrule ?? "")?.[1] ?? "").split(",").filter(Boolean),
      announce: !!c.announce, speaker: c.announce || "media_player.study_speaker", push: !!c.push,
      wa: { christo: (c.wa ?? []).includes("christo"), mandri: (c.wa ?? []).includes("mandri"), liam_eben: (c.wa ?? []).includes("liam_eben") },
    };
    editingUid = r.uid ?? null; building = true; preview = "";
  }

  const recipients = $derived(RECIPIENTS.filter((r) => f.wa[r.key]).map((r) => r.key));
  const canSave = $derived(!!f.title.trim() && (f.useTemplate ? !!f.template : true) && (f.announce || f.push || recipients.length > 0));

  function rrule() {
    if (f.repeat === "daily") return "FREQ=DAILY";
    if (f.repeat === "monthly") return `FREQ=MONTHLY;BYMONTHDAY=${new Date(f.when).getDate()}`;
    if (f.repeat === "weekly") { const days = f.days.length ? f.days.join(",") : WEEKDAYS[(new Date(f.when).getDay() + 6) % 7][0]; return `FREQ=WEEKLY;BYDAY=${days}`; }
    return undefined;
  }
  function payload() {
    return JSON.stringify({ msg: f.useTemplate ? "" : f.msg.trim(), template: f.useTemplate ? f.template : "", announce: f.announce ? f.speaker : "", push: f.push, wa: recipients });
  }
  async function save() {
    if (!canSave) return;
    const startStr = f.when.length === 16 ? f.when + ":00" : f.when;
    const end = new Date(new Date(f.when).getTime() + 60_000);
    await ha.createReminder({ summary: f.title.trim(), description: payload(), start: startStr, end: toLocalInput(end) + ":00", rrule: rrule() });
    if (editingUid) await ha.deleteReminder(editingUid);
    toast.show(editingUid ? "Reminder updated" : "Reminder created");
    building = false; editingUid = null; setTimeout(refresh, 400);
  }
  async function del(r: Reminder) { if (!r.uid) return; await ha.deleteReminder(r.uid, r.recurrence_id); toast.show("Reminder deleted"); reminders = reminders.filter((x) => x.uid !== r.uid); }
  function sendTest() {
    ha.dispatchReminder({ message: f.useTemplate ? "" : f.msg, template: f.useTemplate ? f.template : "", announce: f.announce ? f.speaker : "", push: f.push, wa: recipients });
    toast.show("Test sent");
  }

  // ---- builder preview ----
  let preview = $state("");
  async function doPreview() {
    const body = f.useTemplate ? (f.template ? `render_to(${JSON.stringify(f.template)}, '')` : `''`) : `render(${JSON.stringify(f.msg)})`;
    preview = await ha.renderTemplate(`{% from 'messages.jinja' import render, render_to %}{{ ${body} }}`);
  }

  // ---- per-destination template editor ----
  let editKey = $state("");
  let cellPrev = $state<Record<string, string>>({});
  function pickMsg(k: string) { editKey = k; cellPrev = {}; }
  async function previewCell(dest: string) {
    const m = store[editKey]; if (!m) return;
    const text = (m[dest] && m[dest].trim()) ? m[dest] : m.base;
    cellPrev = { ...cellPrev, [dest]: await ha.renderTemplate(`{% from 'messages.jinja' import render %}{{ render(${JSON.stringify(text)}) }}`) };
  }
  function addMessage() {
    const label = prompt("New message name (e.g. School run)");
    if (!label) return;
    const key = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    if (!key || store[key]) { toast.show("Pick a unique name"); return; }
    store = { ...store, [key]: { label, base: "", announce: "", push_christo: "", wa_christo: "", wa_mandri: "", wa_liam_eben: "" } };
    editKey = key;
  }
  async function saveTemplates() { await ha.saveMessageTemplates(store); toast.show("Templates saved"); setTimeout(loadStore, 600); }
</script>

<div class="col">
  <div class="card head">
    <div><div class="lb">Reminders</div><div class="sub">Announce, push &amp; WhatsApp — once-off or on repeat.</div></div>
    <div class="hact">
      <label class="en"><span>Enabled</span><Toggle on={ha.isOn("input_boolean.reminders_enabled")} onchange={() => ha.toggleBoolean("input_boolean.reminders_enabled")} /></label>
      <button class="new" onclick={openNew}>+ New reminder</button>
    </div>
  </div>

  {#if building}
    <div class="card pad builder">
      <div class="brow"><span class="lb">{editingUid ? "Edit reminder" : "New reminder"}</span><button class="x" onclick={() => (building = false)}>✕</button></div>
      <label class="fld"><span class="fl">Title</span><input bind:value={f.title} placeholder="e.g. Take out the bins" /></label>

      <div class="fld">
        <span class="fl">Message</span>
        <div class="seg2">
          <button class:on={!f.useTemplate} onclick={() => { f.useTemplate = false; preview = ""; }}>Free text</button>
          <button class:on={f.useTemplate} onclick={() => { f.useTemplate = true; preview = ""; }}>Template</button>
        </div>
        {#if f.useTemplate}
          <select bind:value={f.template}>
            <option value="">— pick a message —</option>
            {#each msgKeys as k}<option value={k}>{store[k].label}</option>{/each}
          </select>
          <div class="hint">Uses each destination's wording from the template library below.</div>
        {:else}
          <textarea bind:value={f.msg} rows="2" placeholder="What should it say? Placeholders like greeting or battery work too."></textarea>
        {/if}
        <div class="prev"><button class="pbtn" onclick={doPreview}>Preview</button>{#if preview}<span class="pv">“{preview}”</span>{/if}</div>
      </div>

      <div class="frow">
        <label class="fld"><span class="fl">When</span><input type="datetime-local" bind:value={f.when} /></label>
        <label class="fld"><span class="fl">Repeat</span>
          <select bind:value={f.repeat}><option value="none">Once off</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select>
        </label>
      </div>
      {#if f.repeat === "weekly"}
        <div class="days">{#each WEEKDAYS as [code, lbl]}<button class="day" class:on={f.days.includes(code)} onclick={() => (f.days = f.days.includes(code) ? f.days.filter((d) => d !== code) : [...f.days, code])}>{lbl}</button>{/each}</div>
      {/if}

      <div class="fld">
        <span class="fl">Destinations</span>
        <div class="dest">
          <div class="drow">
            <label class="dl"><span>🔊 Announce</span><Toggle on={f.announce} onchange={() => (f.announce = !f.announce)} /></label>
            {#if f.announce}<select class="spk" bind:value={f.speaker}>{#each SPEAKERS as s}<option value={s.id}>{s.label}</option>{/each}</select>{/if}
          </div>
          <label class="dl"><span>📱 Push → Christo</span><Toggle on={f.push} onchange={() => (f.push = !f.push)} /></label>
          {#each RECIPIENTS as r}
            <label class="dl"><span>💬 WhatsApp {r.label}</span><Toggle on={f.wa[r.key]} onchange={() => (f.wa = { ...f.wa, [r.key]: !f.wa[r.key] })} /></label>
          {/each}
        </div>
      </div>

      <div class="actions">
        <button class="test" onclick={sendTest} disabled={!canSave}>Send test now</button>
        <div class="spacer"></div>
        <button class="cancel" onclick={() => (building = false)}>Cancel</button>
        <button class="save" onclick={save} disabled={!canSave}>{editingUid ? "Update" : "Create"}</button>
      </div>
    </div>
  {/if}

  <div class="card pad">
    <div class="lb" style="margin-bottom:12px">Upcoming · {reminders.length}</div>
    {#if loading}<div class="sub">Loading…</div>
    {:else if reminders.length === 0}<div class="empty">No reminders yet. Tap “New reminder”.</div>
    {:else}
      <div class="rlist">
        {#each reminders as r}
          <div class="rrow">
            <div class="rmain"><div class="rtitle">{r.summary}</div><div class="rmeta">{whenLabel(r)} · <span class="rep">{repeatLabel(r)}</span></div></div>
            <div class="rdest">{#each destChips(r) as d}<span class="chip">{d}</span>{/each}</div>
            <div class="rbtns"><button class="rb" onclick={() => openEdit(r)}>Edit</button><button class="rb del" onclick={() => del(r)}>Delete</button></div>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <!-- per-destination message-template editor -->
  <div class="card pad">
    <div class="rh"><span class="lb">Message templates · per destination</span><button class="addmsg" onclick={addMessage}>+ New message</button></div>
    <div class="tsel">
      {#each msgKeys as k}<button class="tchip" class:on={editKey === k} onclick={() => pickMsg(k)}>{store[k].label}</button>{/each}
      {#if msgKeys.length === 0}<span class="sub">No messages found.</span>{/if}
    </div>
    {#if editKey && store[editKey]}
      <label class="fld" style="margin-bottom:12px"><span class="fl">Base wording (used when a destination is left blank)</span><textarea rows="2" bind:value={store[editKey].base}></textarea></label>
      <div class="grid">
        {#each DESTS as d}
          <div class="cell">
            <div class="clabel">{d.icon} {d.label}</div>
            <textarea rows="2" placeholder="(uses base)" bind:value={store[editKey][d.key]}></textarea>
            <div class="prev"><button class="pbtn" onclick={() => previewCell(d.key)}>Preview</button>{#if cellPrev[d.key]}<span class="pv">“{cellPrev[d.key]}”</span>{/if}</div>
          </div>
        {/each}
      </div>
      <div class="actions"><div class="hint">Placeholders (greeting, battery, tank, alarm…) render live when sent.</div><div class="spacer"></div><button class="save" onclick={saveTemplates}>Save templates</button></div>
    {:else}
      <div class="sub">Pick a message to edit its per-destination wording.</div>
    {/if}
  </div>
</div>

<style>
  .col { display: flex; flex-direction: column; gap: 14px; }
  .head { padding: 18px 22px; display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; }
  .sub { font-size: 12.5px; color: var(--dim); margin-top: 3px; }
  .hact { display: flex; align-items: center; gap: 14px; }
  .en { display: flex; align-items: center; gap: 9px; font-size: 12.5px; color: var(--text-2); font-weight: 600; }
  .new, .addmsg { padding: 10px 15px; border-radius: 12px; background: var(--grad); color: #0b1017; font-size: 12.5px; font-weight: 800; }
  .addmsg { background: rgba(255, 255, 255, 0.07); color: var(--text-2); }
  .pad { padding: 20px 22px; }
  .rh { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 13px; }
  .builder { display: flex; flex-direction: column; gap: 15px; }
  .brow { display: flex; align-items: center; justify-content: space-between; }
  .x { width: 30px; height: 30px; border-radius: 9px; background: rgba(255, 255, 255, 0.07); color: var(--muted); font-size: 14px; }
  .fld { display: flex; flex-direction: column; gap: 7px; }
  .fl { font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
  .frow { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  @media (max-width: 560px) { .frow { grid-template-columns: 1fr; } }
  input, select, textarea { background: rgba(255, 255, 255, 0.06); border: none; border-radius: 11px; color: var(--text); font-size: 13.5px; padding: 11px 13px; outline: none; font-family: inherit; color-scheme: dark; width: 100%; }
  textarea { resize: vertical; }
  input:focus, select:focus, textarea:focus { box-shadow: inset 0 0 0 1.5px var(--line); }
  .seg2 { display: flex; gap: 6px; background: rgba(255, 255, 255, 0.05); border-radius: 11px; padding: 4px; width: max-content; }
  .seg2 button { padding: 7px 16px; border-radius: 8px; font-size: 12px; font-weight: 600; color: var(--text-2); }
  .seg2 button.on { background: var(--grad); color: #0b1017; }
  .prev { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .pbtn { padding: 7px 13px; border-radius: 9px; background: rgba(255, 255, 255, 0.07); color: var(--text-2); font-size: 11.5px; font-weight: 600; flex-shrink: 0; }
  .pv { font-size: 12.5px; color: var(--acc2); font-style: italic; }
  .days { display: flex; gap: 6px; flex-wrap: wrap; }
  .day { width: 44px; padding: 9px 0; border-radius: 10px; background: rgba(255, 255, 255, 0.05); font-size: 12px; font-weight: 600; color: var(--text-2); text-align: center; }
  .day.on { background: var(--soft); box-shadow: inset 0 0 0 1.5px var(--line); color: var(--text); }
  .dest { display: flex; flex-direction: column; gap: 8px; }
  .drow { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .dl { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 11px 14px; border-radius: 12px; background: rgba(255, 255, 255, 0.045); font-size: 13px; flex: 1; min-width: 200px; }
  .spk { width: auto; flex-shrink: 0; }
  .actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .spacer { flex: 1; }
  .test { padding: 10px 15px; border-radius: 11px; background: color-mix(in srgb, var(--warning) 16%, transparent); color: var(--warning); font-size: 12.5px; font-weight: 700; }
  .test:disabled { opacity: 0.4; }
  .cancel { padding: 10px 16px; border-radius: 11px; background: rgba(255, 255, 255, 0.06); color: var(--text-2); font-size: 12.5px; font-weight: 600; }
  .save { padding: 10px 20px; border-radius: 11px; background: var(--grad); color: #0b1017; font-size: 13px; font-weight: 800; }
  .save:disabled { opacity: 0.4; }
  .empty { padding: 16px; border-radius: 12px; background: rgba(255, 255, 255, 0.03); font-size: 13px; color: var(--muted-2); }
  .rlist { display: flex; flex-direction: column; gap: 9px; }
  .rrow { display: flex; align-items: center; gap: 12px; padding: 13px 15px; border-radius: 14px; background: rgba(255, 255, 255, 0.045); flex-wrap: wrap; }
  .rmain { flex: 1; min-width: 160px; }
  .rtitle { font-size: 13.5px; font-weight: 700; }
  .rmeta { font-size: 11.5px; color: var(--dim); margin-top: 2px; }
  .rep { color: var(--acc2); font-weight: 600; }
  .rdest { display: flex; gap: 5px; flex-wrap: wrap; }
  .chip { font-size: 10.5px; font-weight: 700; padding: 4px 9px; border-radius: 999px; background: rgba(255, 255, 255, 0.06); color: var(--text-2); }
  .rbtns { display: flex; gap: 7px; flex-shrink: 0; }
  .rb { padding: 8px 13px; border-radius: 9px; background: rgba(255, 255, 255, 0.07); font-size: 11.5px; font-weight: 600; color: var(--text-2); }
  .rb.del { color: #fecdd6; background: color-mix(in srgb, var(--error) 16%, transparent); }
  .tsel { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 14px; }
  .tchip { padding: 9px 14px; border-radius: 11px; background: rgba(255, 255, 255, 0.05); font-size: 12px; font-weight: 600; color: var(--text-2); }
  .tchip.on { background: var(--soft); box-shadow: inset 0 0 0 1.5px var(--line); color: var(--text); }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px; }
  @media (max-width: 720px) { .grid { grid-template-columns: 1fr; } }
  .cell { display: flex; flex-direction: column; gap: 7px; padding: 12px; border-radius: 12px; background: rgba(255, 255, 255, 0.03); }
  .clabel { font-size: 12px; font-weight: 700; color: var(--text-2); }
  .hint { font-size: 11.5px; color: var(--muted-2); }
</style>
