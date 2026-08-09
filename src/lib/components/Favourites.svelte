<script lang="ts">
  // Overview "Favourites" — a small user-chosen grid of one-tap actions
  // (scenes/scripts, key toggles, arm). Selection + order are per-device
  // (prefs.favourites); the ⚙ inline editor picks from FAV_CATALOGUE.
  import { ha } from "../store.svelte";
  import { E } from "../entities";
  import { prefs } from "../prefs.svelte";
  import { toast } from "../toast.svelte";
  import { actionLog } from "../actionLog.svelte";
  import { FAV_CATALOGUE, favById, type FavTile } from "../favourites";

  let editing = $state(false);

  const tiles = $derived(prefs.favourites.map(favById).filter((t): t is FavTile => !!t));

  // A toggle tile is "active" when its switch is on; arm tile when the alarm is armed.
  function active(t: FavTile): boolean {
    if (t.kind === "toggle") return ha.isOn(t.target);
    if (t.kind === "arm") return (ha.state(E.alarmMain) ?? "").startsWith("armed");
    return false;
  }

  function run(t: FavTile) {
    actionLog.record(t.id); // feed the "Suggested for now" frecency engine
    if (t.kind === "script") { ha.script(t.target); toast.show(`${t.label}`); }
    else if (t.kind === "toggle") { ha.toggle(t.target); }
    else if (t.kind === "arm") {
      const armed = (ha.state(E.alarmMain) ?? "").startsWith("armed");
      if (armed) { ha.disarm(t.target); toast.show("Disarming"); }
      else { ha.armAway(t.target); toast.show("Arming away"); }
    }
  }

  function toggleFav(id: string) {
    const cur = prefs.favourites;
    prefs.favourites = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    prefs.save();
  }
</script>

<div class="fav">
  <div class="fh">
    <span class="lb">Favourites</span>
    <button class="edit" class:on={editing} onclick={() => (editing = !editing)}>{editing ? "Done" : "⚙ Edit"}</button>
  </div>

  {#if editing}
    <div class="picker">
      {#each FAV_CATALOGUE as c (c.id)}
        <button class="pick" class:sel={prefs.favourites.includes(c.id)} onclick={() => toggleFav(c.id)}>
          <span class="pi">{c.icon}</span><span class="pn">{c.label}</span>
          <span class="pc">{prefs.favourites.includes(c.id) ? "✓" : "+"}</span>
        </button>
      {/each}
    </div>
  {:else if tiles.length}
    <div class="grid">
      {#each tiles as t (t.id)}
        <button class="tile" class:on={active(t)} onclick={() => run(t)}>
          <span class="ic">{t.icon}</span>
          <span class="nm">{t.label}</span>
          {#if t.kind !== "script"}<span class="st">{active(t) ? (t.kind === "arm" ? "Armed" : "On") : (t.kind === "arm" ? "Off" : "Off")}</span>{/if}
        </button>
      {/each}
    </div>
  {:else}
    <div class="empty">No favourites yet — tap <b>⚙ Edit</b> to add one-tap actions.</div>
  {/if}
</div>

<style>
  .fav { margin-bottom: 16px; }
  .fh { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
  .lb { font-size: 11px; font-weight: 700; letter-spacing: 0.09em; text-transform: uppercase; color: var(--muted); }
  .edit { font-size: 11.5px; font-weight: 600; color: var(--acc2, var(--acc)); background: rgba(255,255,255,0.05); border-radius: 9px; padding: 5px 11px; }
  .edit:hover { background: rgba(255,255,255,0.1); }
  .edit.on { background: var(--soft); color: var(--acc); }

  .grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; }
  @media (max-width: 1000px) { .grid { grid-template-columns: repeat(4, 1fr); } }
  @media (max-width: 560px) { .grid { grid-template-columns: repeat(3, 1fr); } }

  .tile { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; padding: 15px 8px; border-radius: var(--r-card, 16px); background: rgba(255,255,255,0.045); box-shadow: inset 0 1px 0 rgba(255,255,255,0.06); transition: transform 0.12s, background 0.15s, box-shadow 0.15s; min-height: 86px; }
  .tile:hover { background: rgba(255,255,255,0.08); transform: translateY(-1px); }
  .tile:active { transform: translateY(0) scale(0.98); }
  .tile.on { background: color-mix(in srgb, var(--acc) 16%, transparent); box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--acc) 42%, transparent); }
  .ic { font-size: 22px; line-height: 1; }
  .nm { font-size: 11.5px; font-weight: 600; color: var(--text, #eef4fc); text-align: center; }
  .st { font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
  .tile.on .st { color: var(--acc); }

  .picker { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; padding: 12px; border-radius: 15px; background: rgba(255,255,255,0.03); box-shadow: inset 0 0 0 1px var(--line, rgba(255,255,255,0.07)); }
  .pick { display: flex; align-items: center; gap: 9px; padding: 10px 12px; border-radius: 11px; background: rgba(255,255,255,0.04); text-align: left; }
  .pick:hover { background: rgba(255,255,255,0.08); }
  .pick.sel { background: color-mix(in srgb, var(--acc) 14%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--acc) 40%, transparent); }
  .pi { font-size: 16px; }
  .pn { flex: 1; font-size: 12.5px; font-weight: 600; color: var(--text); }
  .pc { font-size: 13px; font-weight: 800; color: var(--muted); width: 16px; text-align: center; }
  .pick.sel .pc { color: var(--acc); }
  .empty { font-size: 12.5px; color: var(--muted); padding: 14px; border-radius: 13px; background: rgba(255,255,255,0.03); text-align: center; }
</style>
