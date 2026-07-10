<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    title,
    hint = "",
    children,
  }: { title: string; hint?: string; children: Snippet } = $props();
</script>

<section>
  <div class="head">
    <h2 class="t-label">{title}</h2>
    {#if hint}<span class="hint">{hint}</span>{/if}
  </div>
  {@render children()}
</section>

<style>
  section {
    margin-top: 26px;
  }
  .head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: 12px;
    padding: 0 2px;
  }
  h2 {
    margin: 0;
  }
  .hint {
    font-size: 12px;
    color: var(--muted);
  }
</style>
