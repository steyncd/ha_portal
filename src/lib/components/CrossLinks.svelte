<script lang="ts">
  // 2-up strip of cross-link cards (Energy / Power Trends / Insights link to each other).
  let { links, onnav }: { links: { icon: string; title: string; sub: string; to: string }[]; onnav: (id: string) => void } = $props();
</script>

<div class="xlinks">
  {#each links as l}
    <button class="xl" onclick={() => onnav(l.to)}>
      <span class="xi">{l.icon}</span>
      <span class="xt"><span class="xtitle">{l.title}</span><span class="xsub">{l.sub}</span></span>
      <span class="xarr">→</span>
    </button>
  {/each}
</div>

<style>
  .xlinks { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; }
  .xl {
    display: flex; align-items: center; gap: 13px; padding: 15px 17px; text-align: left; cursor: pointer;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.065), rgba(255, 255, 255, 0.028));
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 16px 40px -24px rgba(0, 0, 0, 0.8);
    border-radius: 16px;
  }
  .xl:hover { background: var(--soft); box-shadow: inset 0 0 0 1px var(--line); }
  .xi { font-size: 20px; flex-shrink: 0; }
  .xt { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
  .xtitle { font-size: 13.5px; font-weight: 700; }
  .xsub { font-size: 11.5px; color: var(--muted); }
  .xarr { color: var(--acc); font-weight: 800; flex-shrink: 0; font-size: 15px; }
</style>
