<script lang="ts">
  // The "what needs me now" card at the top of the Overview. Aggregates every
  // actionable signal (see lib/attention.ts) into one prioritised list so the
  // whole house is scannable at a glance; collapses to a calm line when clear.
  import { ha } from "../store.svelte";
  import { E } from "../entities";
  import type { AttnItem } from "../attention";
  import StatusChip from "./StatusChip.svelte";

  let { items, onnav }: { items: AttnItem[]; onnav: (id: string) => void } = $props();

  const topSev = $derived(items[0]?.sev ?? "ok");
  const SEV_COLOR: Record<string, string> = { crit: "var(--error)", warn: "var(--warning)", info: "var(--acc)" };
  const dotColor = $derived(SEV_COLOR[topSev] ?? "var(--success)");
</script>

{#if items.length}
  <div class="attn-card">
    <div class="hd">
      <span class="dot" style="background:{dotColor};box-shadow:0 0 0 4px color-mix(in srgb,{dotColor} 22%,transparent)"></span>
      <span class="ttl">Needs attention</span>
      <span class="cnt">{items.length}</span>
    </div>
    <div class="list">
      {#each items as a (a.key)}
        <div class="row">
          <span class="sev" style="background:{SEV_COLOR[a.sev]}"></span>
          <span class="ic">{a.icon}</span>
          <div class="txt">
            <div class="t">{a.title}</div>
            {#if a.sub}<div class="s">{a.sub}</div>{/if}
          </div>
          {#if a.action}
            <button class="go primary" onclick={a.action.run}>{a.action.label}</button>
          {:else if a.nav}
            <button class="go" onclick={() => onnav(a.nav!)}>Open →</button>
          {/if}
        </div>
      {/each}
    </div>
  </div>
{:else}
  <div class="calm">
    <StatusChip state="ok" label="All clear" />
    <span class="calm-txt">House is calm · {ha.state(E.gridFreeStreak) ?? "—"} grid-free streak</span>
  </div>
{/if}

<style>
  .attn-card { background: linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.025)); border-radius: var(--r-card, 18px); padding: 6px; margin-bottom: 16px; box-shadow: inset 0 1px 0 rgba(255,255,255,0.1), 0 18px 40px -28px #000; }
  .hd { display: flex; align-items: center; gap: 9px; padding: 11px 14px 9px; }
  .dot { width: 9px; height: 9px; border-radius: 50%; flex: none; }
  .ttl { font-size: 11px; font-weight: 700; letter-spacing: 0.09em; text-transform: uppercase; color: var(--muted); }
  .cnt { margin-left: auto; font-size: 12px; font-weight: 800; color: var(--text); font-variant-numeric: tabular-nums; background: rgba(255,255,255,0.06); border-radius: 999px; min-width: 22px; height: 22px; display: grid; place-items: center; padding: 0 7px; }
  .list { display: flex; flex-direction: column; background: rgba(255,255,255,0.02); border-radius: 13px; overflow: hidden; }
  .row { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-bottom: 1px solid rgba(255,255,255,0.05); }
  .row:last-child { border-bottom: 0; }
  .sev { width: 3px; align-self: stretch; border-radius: 3px; flex: none; min-height: 30px; }
  .ic { font-size: 18px; flex: none; width: 24px; text-align: center; }
  .txt { flex: 1; min-width: 0; }
  .t { font-size: 13.5px; font-weight: 650; color: var(--text); }
  .s { font-size: 11.5px; color: var(--muted); margin-top: 2px; }
  .go { flex: none; font-size: 12px; font-weight: 600; color: var(--text-2); background: rgba(255,255,255,0.06); border-radius: 9px; padding: 7px 12px; }
  .go:hover { background: rgba(255,255,255,0.12); color: var(--text); }
  .go.primary { background: var(--grad, var(--acc)); color: #05070c; font-weight: 700; }
  .go.primary:hover { filter: brightness(1.06); }
  .calm { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; padding: 13px 16px; border-radius: 15px; background: color-mix(in srgb, var(--ok) 9%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ok) 22%, transparent); }
  .calm-txt { font-size: 12.5px; color: var(--text-2); }
</style>
