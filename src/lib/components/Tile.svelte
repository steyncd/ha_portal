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
    padding: 15px 16px;
    min-height: 88px;
    background: var(--fill);
    backdrop-filter: var(--glass-blur);
    -webkit-backdrop-filter: var(--glass-blur);
    border: 1px solid var(--border);
    border-radius: var(--r-tile);
    color: var(--text);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
    transition:
      background 0.2s ease,
      border-color 0.2s ease,
      box-shadow 0.2s ease,
      transform 0.08s ease;
  }
  .tile:not(:disabled):hover {
    background: var(--card-hover);
    border-color: var(--border-strong);
  }
  .tile:not(:disabled):active {
    transform: scale(0.97);
  }
  .tile:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .tile.on {
    background: color-mix(in srgb, var(--ac) 20%, transparent);
    border-color: color-mix(in srgb, var(--ac) 65%, transparent);
    box-shadow:
      0 0 0 1px color-mix(in srgb, var(--ac) 30%, transparent),
      0 8px 26px -10px color-mix(in srgb, var(--ac) 70%, transparent),
      inset 0 1px 0 rgba(255, 255, 255, 0.12);
  }
  .ic {
    font-size: 22px;
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
