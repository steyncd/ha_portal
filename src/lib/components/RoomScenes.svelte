<script lang="ts">
  // Room-aware scenes: pick a room, then one verb (Bright / Relax / Off).
  // The same verb does the right thing per room — overheads vs lamps are
  // declared per room in packages/feature_room_scenes.yaml.
  import { ha } from "../store.svelte";
  import { toast } from "../toast.svelte";
  import { actionLog } from "../actionLog.svelte";
  import { SCENE_ROOMS, ROOM_SCENES, type RoomKey } from "../rooms";

  // Remember the last room touched — on a phone there's no true room awareness,
  // so the next best thing is to reopen where you left off.
  const LAST = "ha_portal_last_room";
  let room = $state<RoomKey>(((): RoomKey => {
    const s = localStorage.getItem(LAST) as RoomKey | null;
    return s && SCENE_ROOMS.some((r) => r.key === s) ? s : "main_bedroom";
  })());
  $effect(() => { localStorage.setItem(LAST, room); });

  const current = $derived(SCENE_ROOMS.find((r) => r.key === room)!);
  const litCount = $derived(current.lights.filter((id) => ha.isOn(id)).length);

  let ran = $state<string | null>(null);
  let timer: ReturnType<typeof setTimeout> | undefined;
  function run(scene: "bright" | "relax" | "off") {
    ha.roomScene(room, scene);
    actionLog.record(`room:${scene}`);
    toast.show(`${current.label} · ${scene}`);
    ran = scene;
    clearTimeout(timer);
    timer = setTimeout(() => (ran = null), 1200);
  }
</script>

<div class="rs">
  <div class="sh">
    <span class="st">Room scenes</span>
    <span class="cnt">{litCount} of {current.lights.length} on in {current.label}</span>
  </div>

  <div class="rooms">
    {#each SCENE_ROOMS as r (r.key)}
      {@const on = r.lights.filter((id) => ha.isOn(id)).length}
      <button class="room" class:sel={room === r.key} onclick={() => (room = r.key)}>
        <span class="ri">{r.icon}</span>
        <span class="rn">{r.label}</span>
        {#if on}<span class="dot" title="{on} on"></span>{/if}
      </button>
    {/each}
  </div>

  <div class="verbs">
    {#each ROOM_SCENES as s (s.key)}
      <button class="verb" class:done={ran === s.key} onclick={() => run(s.key)}>
        <span class="vi">{ran === s.key ? "✓" : s.icon}</span>
        <span class="vn">{s.label}</span>
      </button>
    {/each}
  </div>
</div>

<style>
  .rs { padding: 16px; border-radius: 16px; background: rgba(255,255,255,0.03); box-shadow: inset 0 0 0 1px var(--line); }
  .sh { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; margin-bottom: 11px; }
  .st { font-size: 11px; font-weight: 700; letter-spacing: 0.09em; text-transform: uppercase; color: var(--muted); }
  .cnt { font-size: 11px; color: var(--muted-2); }

  .rooms { display: flex; flex-wrap: wrap; gap: 7px; margin-bottom: 12px; }
  .room { position: relative; display: inline-flex; align-items: center; gap: 7px; padding: 8px 12px; border-radius: 10px; background: rgba(255,255,255,0.045); font-size: 12px; font-weight: 600; color: var(--text-2); }
  .room:hover { background: rgba(255,255,255,0.085); color: var(--text); }
  .room.sel { background: var(--soft); color: var(--acc); box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--acc) 45%, transparent); }
  .ri { font-size: 14px; }
  .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--warning); box-shadow: 0 0 6px var(--warning); }

  .verbs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 9px; }
  .verb { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; padding: 14px 8px; border-radius: 13px; background: rgba(255,255,255,0.05); transition: transform 0.12s, background 0.15s; }
  .verb:hover { background: rgba(255,255,255,0.09); transform: translateY(-1px); }
  .verb:active { transform: scale(0.97); }
  .verb.done { background: color-mix(in srgb, var(--success) 20%, transparent); box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--success) 50%, transparent); }
  .vi { font-size: 19px; line-height: 1; }
  .verb.done .vi { color: var(--success); }
  .vn { font-size: 11.5px; font-weight: 700; }
</style>
