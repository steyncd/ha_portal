<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    icon,
    label,
    value,
    unit = "",
    accent = "var(--brand)",
    foots = [],
    right,
  }: {
    icon: string;
    label: string;
    value: string;
    unit?: string;
    accent?: string;
    foots?: { v: string; l: string }[];
    right?: Snippet;
  } = $props();
</script>

<div class="kpi card" style="--ac:{accent}">
  <div class="body">
    <div class="left">
      <div class="head">
        <span class="ic">{icon}</span>
        <span class="t-label">{label}</span>
      </div>
      <div class="big">
        {value}{#if unit}<span class="unit">{unit}</span>{/if}
      </div>
    </div>
    {#if right}
      <div class="right">{@render right()}</div>
    {/if}
  </div>

  {#if foots.length}
    <hr class="hr" />
    <div class="foots">
      {#each foots as f}
        <div class="foot">
          <div class="fv">{f.v}</div>
          <div class="t-foot">{f.l}</div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .kpi {
    position: relative;
    overflow: hidden;
    padding: 20px;
  }
  .kpi::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: var(--ac);
  }
  .body {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 14px;
  }
  .head {
    display: flex;
    align-items: center;
    gap: 9px;
  }
  .ic {
    font-size: 18px;
    line-height: 1;
  }
  .big {
    font-size: 40px;
    font-weight: 700;
    line-height: 1;
    letter-spacing: -1.3px;
    margin-top: 14px;
  }
  .unit {
    font-size: 19px;
    font-weight: 600;
    color: var(--text-2);
    margin-left: 5px;
    letter-spacing: 0;
  }
  .right {
    flex-shrink: 0;
  }
  .foots {
    display: flex;
    gap: 20px;
  }
  .foot {
    min-width: 0;
  }
  .fv {
    font-size: 16px;
    font-weight: 700;
  }
</style>
