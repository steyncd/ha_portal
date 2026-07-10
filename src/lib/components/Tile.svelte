<script lang="ts">
  let {
    icon,
    name,
    sub = "",
    on = false,
    disabled = false,
    accent = "var(--warning)",
    onclick,
  }: {
    icon: string;
    name: string;
    sub?: string;
    on?: boolean;
    disabled?: boolean;
    accent?: string;
    onclick?: () => void;
  } = $props();
</script>

<button
  class="tile"
  class:on
  {disabled}
  style="--ac:{accent}"
  {onclick}
>
  <span class="ic">{icon}</span>
  <span class="name">{name}</span>
  {#if sub}<span class="sub">{sub}</span>{/if}
</button>

<style>
  .tile {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    text-align: left;
    width: 100%;
    padding: 13px 14px;
    min-height: 84px;
    background: var(--fill);
    border: 1px solid var(--border);
    border-radius: var(--r-tile);
    color: var(--text);
    transition:
      background 0.15s ease,
      border-color 0.15s ease,
      transform 0.07s ease;
  }
  .tile:not(:disabled):hover {
    background: var(--card-hover);
  }
  .tile:not(:disabled):active {
    transform: scale(0.97);
  }
  .tile:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .tile.on {
    background: color-mix(in srgb, var(--ac) 14%, transparent);
    border-color: color-mix(in srgb, var(--ac) 55%, transparent);
  }
  .ic {
    font-size: 21px;
    line-height: 1;
    filter: grayscale(0.5) opacity(0.7);
  }
  .tile.on .ic {
    filter: none;
  }
  .name {
    font-size: 13px;
    font-weight: 600;
    line-height: 1.2;
  }
  .sub {
    margin-top: auto;
    font-size: 10.5px;
    letter-spacing: 0.4px;
    text-transform: uppercase;
    color: var(--muted);
  }
  .tile.on .sub {
    color: var(--ac);
  }
</style>
