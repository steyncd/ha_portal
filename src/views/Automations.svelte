<script lang="ts">
  // Automations panel — every automation.* entity with enable/disable, run-now,
  // and last-triggered time. Search filters by friendly name.
  import { ha } from "../lib/store.svelte";
  import { toast } from "../lib/toast.svelte";
  import Toggle from "../lib/components/Toggle.svelte";

  let q = $state("");

  type Row = { id: string; name: string; on: boolean; last: string | null };

  const rows = $derived.by<Row[]>(() => {
    const out: Row[] = [];
    for (const e of Object.values(ha.entities)) {
      if (!e.entity_id.startsWith("automation.")) continue;
      out.push({
        id: e.entity_id,
        name: (e.attributes?.friendly_name as string) ?? e.entity_id.replace("automation.", "").replace(/_/g, " "),
        on: e.state === "on",
        last: (e.attributes?.last_triggered as string) ?? null,
      });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  });

  const filtered = $derived(
    q.trim() ? rows.filter((r) => r.name.toLowerCase().includes(q.trim().toLowerCase())) : rows,
  );
  const onCount = $derived(rows.filter((r) => r.on).length);

  function ago(iso: string | null): string {
    if (!iso) return "never run";
    const ms = Date.now() - Date.parse(iso);
    if (!Number.isFinite(ms)) return "";
    const m = Math.round(ms / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m} min ago`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.round(h / 24)}d ago`;
  }

  function toggle(r: Row) {
    ha.setAutomation(r.id, !r.on);
  }
  function run(r: Row) {
    ha.triggerAutomation(r.id);
    toast.show(`Ran “${r.name}”`);
  }
</script>

<div class="wrap">
  <div class="bar">
    <input class="search" type="search" placeholder="Search automations…" bind:value={q} />
    <span class="count">{onCount}/{rows.length} on</span>
  </div>

  {#if !rows.length}
    <p class="empty">No automations found.</p>
  {:else}
    <div class="list">
      {#each filtered as r (r.id)}
        <div class="row" class:off={!r.on}>
          <div class="meta">
            <div class="nm">{r.name}</div>
            <div class="sub">{r.on ? "Enabled" : "Disabled"} · last {ago(r.last)}</div>
          </div>
          <button class="run" onclick={() => run(r)} title="Run now">Run</button>
          <button class="tg" onclick={() => toggle(r)} aria-label={r.on ? "Disable" : "Enable"}>
            <Toggle on={r.on} />
          </button>
        </div>
      {/each}
      {#if !filtered.length}<p class="empty">No matches for “{q}”.</p>{/if}
    </div>
  {/if}
</div>

<style>
  .wrap { display: flex; flex-direction: column; gap: 12px; max-width: 720px; margin: 0 auto; width: 100%; }
  .bar { display: flex; align-items: center; gap: 12px; }
  .search { flex: 1; padding: 11px 14px; border-radius: 12px; background: rgba(255, 255, 255, 0.05); border: 1px solid var(--line, rgba(255, 255, 255, 0.08)); color: var(--text); font-size: 14px; }
  .count { font-size: 12px; color: var(--muted); white-space: nowrap; }
  .list { display: flex; flex-direction: column; gap: 8px; }
  .row { display: flex; align-items: center; gap: 12px; background: var(--card, rgba(255, 255, 255, 0.04)); border: 1px solid var(--line, rgba(255, 255, 255, 0.08)); border-radius: 14px; padding: 12px 14px; }
  .row.off { opacity: 0.72; }
  .meta { flex: 1; min-width: 0; }
  .nm { font-size: 14px; font-weight: 600; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sub { font-size: 12px; color: var(--muted); margin-top: 2px; }
  .run { padding: 7px 14px; border-radius: 10px; background: rgba(255, 255, 255, 0.06); border: 1px solid var(--line, rgba(255, 255, 255, 0.08)); color: var(--text); font-weight: 600; font-size: 12.5px; }
  .run:hover { background: rgba(255, 255, 255, 0.1); }
  .tg { background: none; border: none; display: flex; }
  .empty { font-size: 13px; color: var(--muted); text-align: center; padding: 24px 0; }
</style>
