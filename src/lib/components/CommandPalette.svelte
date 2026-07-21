<script lang="ts">
  import { ha } from "../store.svelte";
  import { E, ALL_LIGHTS } from "../entities";
  import { NAV, GUEST_HIDDEN, type ViewId } from "../nav";
  import { prefs } from "../prefs.svelte";
  import { toast } from "../toast.svelte";

  let {
    open,
    onnav,
    onclose,
  }: { open: boolean; onnav: (id: ViewId) => void; onclose: () => void } = $props();

  let q = $state("");
  let input = $state<HTMLInputElement>();

  type Cmd = { icon: string; label: string; hint: string; run: () => void };

  const armTarget = "alarm_control_panel.helloliam_alarm_area_01_huis";

  const all = $derived<Cmd[]>([
    ...NAV.filter((n) => !prefs.guest || !GUEST_HIDDEN.includes(n.id)).map((n) => ({ icon: n.icon, label: n.name, hint: "View", run: () => onnav(n.id) })),
    { icon: prefs.guest ? "🔓" : "👋", label: prefs.guest ? "Exit guest view" : "Enter guest view", hint: "Mode", run: () => { prefs.guest = !prefs.guest; prefs.save(); toast.show(prefs.guest ? "Guest view on" : "Guest view off"); } },
    { icon: "🌙", label: "Goodnight scene", hint: "Scene", run: () => { ha.script(E.scGoodnight); toast.show("Goodnight scene"); } },
    { icon: "🎬", label: "Movie mode", hint: "Scene", run: () => { ha.script(E.scMovie); toast.show("Movie mode"); } },
    { icon: "🚪", label: "Away mode", hint: "Scene", run: () => { ha.script(E.scAway); toast.show("Away mode"); } },
    { icon: "☀️", label: "Good morning", hint: "Scene", run: () => { ha.script(E.scMorning); toast.show("Good morning"); } },
    { icon: "🌑", label: "All lights off", hint: "Action", run: () => { ha.turnOff(ALL_LIGHTS); toast.show("Lights off"); } },
    { icon: "🛡️", label: "Arm away", hint: "Security", run: () => { ha.armAway(armTarget); toast.show("Arming away"); } },
    { icon: "🔓", label: "Disarm", hint: "Security", run: () => { ha.disarm(armTarget); toast.show("Disarmed"); } },
    { icon: "💧", label: "Toggle water pump", hint: "Pump", run: () => ha.toggle(E.waterPump) },
    { icon: "🏊", label: "Toggle pool pump", hint: "Pump", run: () => ha.toggle(E.poolPump) },
    { icon: "🕳️", label: "Toggle borehole", hint: "Pump", run: () => ha.toggle(E.boreholePump) },
  ]);

  const filtered = $derived(
    q.trim()
      ? all.filter((c) => c.label.toLowerCase().includes(q.trim().toLowerCase()))
      : all,
  );

  $effect(() => {
    if (open) {
      q = "";
      setTimeout(() => input?.focus(), 30);
    }
  });

  function pick(c: Cmd) {
    c.run();
    onclose();
  }
  function onkey(e: KeyboardEvent) {
    if (e.key === "Escape") onclose();
    if (e.key === "Enter" && filtered[0]) pick(filtered[0]);
  }
</script>

{#if open}
  <div class="scrim" onclick={onclose} role="presentation">
    <div class="palette" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
      <div class="search">
        <span class="cmd">⌘</span>
        <input bind:this={input} bind:value={q} onkeydown={onkey} placeholder="Search views, scenes, devices…" />
        <span class="esc">ESC</span>
      </div>
      <div class="list">
        {#each filtered as c}
          <button class="item" onclick={() => pick(c)}>
            <span class="ic">{c.icon}</span>
            <span class="label">{c.label}</span>
            <span class="hint">{c.hint}</span>
          </button>
        {/each}
        {#if filtered.length === 0}
          <div class="empty">No matches</div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 60;
    background: rgba(4, 8, 13, 0.62);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 12vh 16px 16px;
    animation: pfade 0.16s ease;
  }
  .palette {
    width: min(560px, 94vw);
    border-radius: 18px;
    background: rgba(15, 21, 30, 0.99);
    box-shadow: 0 30px 80px -20px rgba(0, 0, 0, 0.85), inset 0 1px 0 rgba(255, 255, 255, 0.09);
    overflow: hidden;
    animation: ppop 0.18s cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  .search {
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 15px 18px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  }
  .cmd {
    font-size: 15px;
    color: var(--muted);
  }
  .search input {
    flex: 1;
    background: none;
    border: none;
    outline: none;
    color: var(--text);
    font-size: 15px;
  }
  .esc {
    font-size: 10px;
    color: var(--muted-2);
    padding: 3px 7px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.06);
  }
  .list {
    max-height: 46vh;
    overflow-y: auto;
    padding: 8px;
  }
  .item {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 11px 12px;
    border-radius: 11px;
    text-align: left;
  }
  .item:hover {
    background: rgba(255, 255, 255, 0.06);
  }
  .ic {
    width: 32px;
    height: 32px;
    flex-shrink: 0;
    border-radius: 9px;
    background: rgba(255, 255, 255, 0.06);
    display: grid;
    place-items: center;
    font-size: 15px;
  }
  .label {
    flex: 1;
    font-size: 13.5px;
    color: var(--text);
    font-weight: 500;
  }
  .hint {
    font-size: 10px;
    color: var(--muted-2);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .empty {
    padding: 20px;
    text-align: center;
    color: var(--muted-2);
    font-size: 13px;
  }
</style>
