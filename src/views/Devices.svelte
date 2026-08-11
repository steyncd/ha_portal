<script lang="ts">
  // Universal entity control — search any controllable entity and act on it
  // inline (toggle, run, press, open/close, lock, set number/option) without
  // opening Home Assistant. Automations live in their own tab, so are excluded.
  import { ha } from "../lib/store.svelte";
  import Toggle from "../lib/components/Toggle.svelte";

  // domain → control kind
  const KIND: Record<string, "toggle" | "cover" | "lock" | "run" | "press" | "number" | "select"> = {
    light: "toggle", switch: "toggle", fan: "toggle", input_boolean: "toggle",
    cover: "cover", lock: "lock", scene: "run", script: "run", button: "press",
    input_number: "number", input_select: "select",
  };
  const DOMAIN_LABEL: Record<string, string> = {
    light: "Lights", switch: "Switches", fan: "Fans", input_boolean: "Helpers",
    cover: "Covers", lock: "Locks", scene: "Scenes", script: "Scripts",
    button: "Buttons", input_number: "Numbers", input_select: "Selects",
  };
  const CAP = 300;

  let q = $state("");
  let domain = $state("all");

  type Row = { id: string; name: string; domain: string; kind: string; state: string; attrs: Record<string, unknown> };

  const all = $derived.by<Row[]>(() => {
    const out: Row[] = [];
    for (const e of Object.values(ha.entities)) {
      const d = e.entity_id.split(".")[0];
      const kind = KIND[d];
      if (!kind) continue;
      out.push({
        id: e.entity_id,
        name: (e.attributes?.friendly_name as string) ?? e.entity_id,
        domain: d,
        kind,
        state: e.state,
        attrs: e.attributes ?? {},
      });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  });

  const domains = $derived([...new Set(all.map((r) => r.domain))].sort());

  const filtered = $derived.by(() => {
    const term = q.trim().toLowerCase();
    return all.filter(
      (r) => (domain === "all" || r.domain === domain) && (!term || r.name.toLowerCase().includes(term)),
    );
  });
  const shown = $derived(filtered.slice(0, CAP));

  const on = (r: Row) => r.state === "on";
</script>

<div class="wrap">
  <input class="search" type="search" placeholder="Search {all.length} controllable entities…" bind:value={q} />

  <div class="chips">
    <button class="chip" class:on={domain === "all"} onclick={() => (domain = "all")}>All</button>
    {#each domains as d}
      <button class="chip" class:on={domain === d} onclick={() => (domain = d)}>{DOMAIN_LABEL[d] ?? d}</button>
    {/each}
  </div>

  <div class="list">
    {#each shown as r (r.id)}
      <div class="row">
        <div class="meta">
          <div class="nm">{r.name}</div>
          <div class="sub">{DOMAIN_LABEL[r.domain] ?? r.domain} · {r.state}</div>
        </div>

        {#if r.kind === "toggle"}
          <button class="tg" onclick={() => ha.toggle(r.id)} aria-label="Toggle"><Toggle on={on(r)} /></button>
        {:else if r.kind === "cover"}
          <div class="pair">
            <button class="mini" class:act={r.state === "open"} onclick={() => ha.cover(r.id, true)}>Open</button>
            <button class="mini" class:act={r.state !== "open"} onclick={() => ha.cover(r.id, false)}>Close</button>
          </div>
        {:else if r.kind === "lock"}
          <div class="pair">
            <button class="mini" class:act={r.state === "locked"} onclick={() => ha.lock(r.id, true)}>Lock</button>
            <button class="mini" class:act={r.state !== "locked"} onclick={() => ha.lock(r.id, false)}>Unlock</button>
          </div>
        {:else if r.kind === "run"}
          <button class="mini go" onclick={() => (r.domain === "scene" ? ha.scene(r.id) : ha.script(r.id))}>Run</button>
        {:else if r.kind === "press"}
          <button class="mini go" onclick={() => ha.pressButton(r.id)}>Press</button>
        {:else if r.kind === "number"}
          <input
            class="num"
            type="number"
            value={r.state}
            min={(r.attrs.min as number) ?? undefined}
            max={(r.attrs.max as number) ?? undefined}
            step={(r.attrs.step as number) ?? undefined}
            onchange={(e) => ha.setNumber(r.id, Number((e.currentTarget as HTMLInputElement).value))}
          />
        {:else if r.kind === "select"}
          <select class="sel" value={r.state} onchange={(e) => ha.setSelect(r.id, (e.currentTarget as HTMLSelectElement).value)}>
            {#each ((r.attrs.options as string[]) ?? []) as opt}<option value={opt}>{opt}</option>{/each}
          </select>
        {/if}
      </div>
    {/each}
    {#if !filtered.length}<p class="empty">No matching entities.</p>{/if}
    {#if filtered.length > CAP}<p class="empty">Showing first {CAP} of {filtered.length} — narrow with search.</p>{/if}
  </div>
</div>

<style>
  .wrap { display: flex; flex-direction: column; gap: 12px; max-width: 720px; margin: 0 auto; width: 100%; }
  .search { padding: 11px 14px; border-radius: 12px; background: rgba(255, 255, 255, 0.05); border: 1px solid var(--line, rgba(255, 255, 255, 0.08)); color: var(--text); font-size: 14px; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip { padding: 6px 12px; border-radius: 999px; background: rgba(255, 255, 255, 0.05); border: 1px solid var(--line, rgba(255, 255, 255, 0.08)); color: var(--muted); font-size: 12.5px; font-weight: 600; }
  .chip.on { background: var(--grad, rgba(110, 168, 254, 0.2)); color: #0b1017; border-color: transparent; }
  .list { display: flex; flex-direction: column; gap: 8px; }
  .row { display: flex; align-items: center; gap: 12px; background: var(--card, rgba(255, 255, 255, 0.04)); border: 1px solid var(--line, rgba(255, 255, 255, 0.08)); border-radius: 14px; padding: 12px 14px; }
  .meta { flex: 1; min-width: 0; }
  .nm { font-size: 14px; font-weight: 600; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sub { font-size: 12px; color: var(--muted); margin-top: 2px; text-transform: capitalize; }
  .tg { background: none; border: none; display: flex; }
  .pair { display: flex; gap: 6px; }
  .mini { padding: 7px 12px; border-radius: 10px; background: rgba(255, 255, 255, 0.06); border: 1px solid var(--line, rgba(255, 255, 255, 0.08)); color: var(--text); font-weight: 600; font-size: 12.5px; }
  .mini.act { background: var(--grad, rgba(110, 168, 254, 0.2)); color: #0b1017; border-color: transparent; }
  .mini.go { background: rgba(255, 255, 255, 0.08); }
  .num { width: 92px; padding: 8px 10px; border-radius: 10px; background: rgba(255, 255, 255, 0.05); border: 1px solid var(--line, rgba(255, 255, 255, 0.08)); color: var(--text); font-size: 13px; }
  .sel { padding: 8px 10px; border-radius: 10px; background: rgba(255, 255, 255, 0.05); border: 1px solid var(--line, rgba(255, 255, 255, 0.08)); color: var(--text); font-size: 13px; max-width: 160px; }
  .empty { font-size: 13px; color: var(--muted); text-align: center; padding: 24px 0; }
</style>
