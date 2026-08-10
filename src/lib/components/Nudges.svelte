<script lang="ts">
  // Proactive AI nudges — "the house noticed something".
  // Distinct from "Needs attention" (deterministic threshold rules): these come
  // from a contextual Gemini scan and are deliberately rare, so they're styled
  // as a conversational heads-up rather than another alert row.
  import { onMount } from "svelte";
  import { subscribeNudges, dismissNudge, type Nudge } from "../nudges";

  let { onnav }: { onnav: (id: string) => void } = $props();

  let items = $state<Nudge[]>([]);
  onMount(() => subscribeNudges((n) => (items = n)));

  function ago(ts: number): string {
    const m = Math.round((Date.now() - ts) / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    return `${Math.round(m / 60)}h ago`;
  }
</script>

{#each items as nd (nd.id)}
  <div class="nudge" class:urgent={nd.urgent}>
    <span class="ic">{nd.urgent ? "⚠️" : "💡"}</span>
    <div class="body">
      <div class="ttl">{nd.title}</div>
      <div class="msg">{nd.body}</div>
      <div class="meta">Noticed {ago(nd.ts)}</div>
    </div>
    <div class="acts">
      <button class="go" onclick={() => { onnav(nd.view); dismissNudge(nd.id); }}>Take a look</button>
      <button class="dis" onclick={() => dismissNudge(nd.id)}>Dismiss</button>
    </div>
  </div>
{/each}

<style>
  .nudge { display: flex; align-items: flex-start; gap: 13px; padding: 15px 17px; margin-bottom: 12px; border-radius: 15px; background: color-mix(in srgb, var(--acc) 9%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--acc) 28%, transparent); animation: ppop 0.2s ease; }
  .nudge.urgent { background: color-mix(in srgb, var(--warning) 12%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--warning) 38%, transparent); }
  .ic { font-size: 19px; line-height: 1.2; flex-shrink: 0; }
  .body { flex: 1; min-width: 0; }
  .ttl { font-size: 13.5px; font-weight: 750; color: var(--text); }
  .msg { font-size: 12.5px; color: var(--text-2); margin-top: 3px; line-height: 1.5; }
  .meta { font-size: 10.5px; color: var(--muted-2); margin-top: 5px; }
  .acts { display: flex; flex-direction: column; gap: 6px; flex-shrink: 0; }
  .go { padding: 7px 14px; border-radius: 9px; background: var(--grad); color: #06121b; font-size: 11.5px; font-weight: 700; white-space: nowrap; }
  .dis { padding: 6px 14px; border-radius: 9px; font-size: 11px; font-weight: 600; color: var(--muted); }
  .dis:hover { background: rgba(255,255,255,0.07); color: var(--text-2); }
  @media (max-width: 560px) {
    .nudge { flex-wrap: wrap; }
    .acts { flex-direction: row; width: 100%; }
    .go, .dis { flex: 1; text-align: center; }
  }
</style>
