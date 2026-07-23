<script lang="ts">
  // Energy hub — folds Energy / Power Trends / Solar into one nav item with tabs,
  // so the Energy group is a single entry instead of three. Each tab lazy-loads
  // its full view unchanged.
  let { onnav }: { onnav?: (id: string) => void } = $props();

  const TABS = [
    { id: "energy", label: "Overview", load: () => import("./Energy.svelte") },
    { id: "trends", label: "Trends", load: () => import("./PowerTrends.svelte") },
    { id: "solar", label: "Solar", load: () => import("./Solar.svelte") },
  ];
  let tab = $state("energy");
  const active = $derived(TABS.find((t) => t.id === tab)!);
  function pick(id: string) { tab = id; }
</script>

<div class="hub">
  <div class="tabs">
    {#each TABS as t}
      <button class="tab" class:on={tab === t.id} onclick={() => pick(t.id)}>{t.label}</button>
    {/each}
  </div>
  <div class="hbody">
    {#key tab}
      {#await active.load()}
        <div class="load"><div class="spinner"></div></div>
      {:then mod}
        {@const Cmp = mod.default as unknown as typeof import("./Energy.svelte").default}
        <Cmp {onnav} />
      {/await}
    {/key}
  </div>
</div>

<style>
  .hub { display: flex; flex-direction: column; gap: 14px; }
  .tabs { display: flex; gap: 4px; background: rgba(255, 255, 255, 0.05); border-radius: 12px; padding: 4px; align-self: flex-start; max-width: 1180px; margin: 0 auto; width: 100%; }
  .tab { padding: 8px 18px; border-radius: 9px; font-size: 13px; font-weight: 600; color: var(--text); }
  .tab.on { background: var(--grad); color: #0b1017; }
  .load { display: grid; place-items: center; min-height: 200px; }
  .spinner { width: 26px; height: 26px; border: 3px solid var(--line); border-top-color: var(--acc); border-radius: 50%; animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
