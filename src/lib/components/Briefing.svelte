<script lang="ts">
  // Overview "briefing" card — a morning (today-at-a-glance) or evening
  // (wind-down) digest composed server-side from HA + the reminders calendar
  // (/api/briefing). Also pushed to devices at 06:30 / 20:30 by the scheduled
  // morningBriefing / eveningBriefing functions.
  import { onMount } from "svelte";
  import { getBriefing, type Briefing } from "../briefing";

  let b = $state<Briefing | null>(null);
  let loading = $state(true);
  let err = $state("");

  const isMock = typeof location !== "undefined" && new URLSearchParams(location.search).get("mock") === "1";

  function demo(): Briefing {
    const morning = new Date().getHours() < 15;
    return morning
      ? { ok: true, period: "morning", title: "Good morning, Christo", summary: "", speech: "",
          lines: [
            { icon: "⛅", text: "18° out now" },
            { icon: "💍", text: "Readiness 67 · slept 72" },
            { icon: "📅", text: "3 today · first 8am School run" },
            { icon: "🔌", text: "✅ No loadshedding" },
            { icon: "☀️", text: "42 kWh solar expected" },
          ] }
      : { ok: true, period: "evening", title: "Winding down", summary: "", speech: "",
          lines: [
            { icon: "📅", text: "Tomorrow: 2 on · first 9am Dentist" },
            { icon: "💡", text: "3 lights still on" },
            { icon: "🛡️", text: "Alarm is off — arm before bed?" },
            { icon: "🔋", text: "Battery reserve 76%" },
          ] };
  }

  async function load() {
    loading = true; err = "";
    try {
      if (isMock) { b = demo(); }
      else {
        const r = await getBriefing();
        if (r.ok) b = r; else err = r.error || "Couldn't load briefing";
      }
    } catch (e) { err = e instanceof Error ? e.message : String(e); }
    loading = false;
  }
  onMount(load);
</script>

<div class="w card brief">
  <div class="bh">
    <span class="ic">{b?.period === "evening" ? "🌙" : "☀️"}</span>
    <span class="ttl">{b?.title ?? (loading ? "Loading briefing…" : "Briefing")}</span>
    <button class="rf" onclick={load} aria-label="Refresh briefing" title="Refresh">↻</button>
  </div>

  {#if loading}
    <div class="skel"><span></span><span></span><span></span></div>
  {:else if err}
    <div class="err">{err}</div>
  {:else if b}
    <div class="lines">
      {#each b.lines as l (l.text)}
        <div class="ln"><span class="li">{l.icon}</span><span class="lt">{l.text}</span></div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .brief { padding: 18px; }
  .bh { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
  .ic { font-size: 20px; }
  .ttl { font-size: 15px; font-weight: 800; letter-spacing: -0.2px; flex: 1; min-width: 0; }
  .rf { width: 28px; height: 28px; border-radius: 8px; background: rgba(255,255,255,0.06); color: var(--text-2); font-size: 15px; flex: none; }
  .rf:hover { background: rgba(255,255,255,0.12); color: var(--text); }
  .lines { display: flex; flex-direction: column; gap: 10px; }
  .ln { display: flex; align-items: baseline; gap: 11px; font-size: 13px; color: var(--text-2); }
  .li { font-size: 15px; flex: none; width: 20px; text-align: center; }
  .lt { line-height: 1.35; }
  .err { font-size: 12.5px; color: var(--muted); }
  .skel { display: flex; flex-direction: column; gap: 10px; }
  .skel span { height: 13px; border-radius: 6px; background: rgba(255,255,255,0.06); animation: pulse 1.3s ease-in-out infinite; }
  .skel span:nth-child(1) { width: 80%; } .skel span:nth-child(2) { width: 65%; } .skel span:nth-child(3) { width: 72%; }
  @keyframes pulse { 0%,100% { opacity: 0.5; } 50% { opacity: 1; } }
</style>
