<script lang="ts">
  // "You" hub — folds Me + Vitality into one nav item with tabs, so the You group
  // is a single entry. Each tab lazy-loads its full view unchanged.
  const TABS = [
    { id: "me", label: "Health", load: () => import("./Me.svelte") },
    { id: "vitality", label: "Vitality", load: () => import("./Vitality.svelte") },
  ];
  let tab = $state("me");
  const active = $derived(TABS.find((t) => t.id === tab)!);
</script>

<div class="hub">
  <div class="tabs">
    {#each TABS as t}
      <button class="tab" class:on={tab === t.id} onclick={() => (tab = t.id)}>{t.label}</button>
    {/each}
  </div>
  <div class="hbody">
    {#key tab}
      {#await active.load()}
        <div class="load"><div class="spinner"></div></div>
      {:then mod}
        {@const Cmp = mod.default}
        <Cmp />
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
