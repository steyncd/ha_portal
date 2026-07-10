<script lang="ts">
  import type { HassEntities } from "./ha";

  let {
    entity,
    toggleable,
    onToggle,
  }: {
    entity: HassEntities[string];
    toggleable: boolean;
    onToggle: () => void;
  } = $props();

  const domain = $derived(entity.entity_id.split(".")[0]);
  const name = $derived(
    (entity.attributes.friendly_name as string) ?? entity.entity_id,
  );
  const isOn = $derived(toggleable && entity.state === "on");

  const ICONS: Record<string, string> = {
    light: "💡",
    switch: "🔌",
    fan: "🌀",
    cover: "🪟",
    lock: "🔒",
    climate: "🌡️",
    input_boolean: "🎚️",
    binary_sensor: "📶",
    sensor: "📊",
    media_player: "🔊",
    person: "🧍",
    device_tracker: "📍",
    weather: "⛅",
    automation: "⚙️",
    camera: "📷",
  };
  const icon = $derived(ICONS[domain] ?? "📦");

  // Human-friendly value: numeric sensors show their unit.
  const display = $derived.by(() => {
    const unit = entity.attributes.unit_of_measurement as string | undefined;
    if (unit && !Number.isNaN(Number(entity.state))) {
      return `${entity.state} ${unit}`;
    }
    return entity.state;
  });
</script>

<button
  class="card"
  class:on={isOn}
  class:static={!toggleable}
  onclick={onToggle}
  disabled={!toggleable}
  title={entity.entity_id}
>
  <span class="icon">{icon}</span>
  <span class="name">{name}</span>
  <span class="state">{display}</span>
</button>

<style>
  .card {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
    text-align: left;
    padding: 16px;
    min-height: 118px;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text);
    transition:
      background 0.15s ease,
      transform 0.08s ease,
      border-color 0.15s ease;
  }
  .card:not(.static):hover {
    background: var(--card-hover);
  }
  .card:not(.static):active {
    transform: scale(0.97);
  }
  .card.static {
    cursor: default;
  }
  .card.on {
    background: var(--on-soft);
    border-color: var(--on);
  }
  .icon {
    font-size: 22px;
    line-height: 1;
    filter: grayscale(0.2);
  }
  .card.on .icon {
    filter: none;
  }
  .name {
    font-size: 14px;
    font-weight: 600;
    line-height: 1.25;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .state {
    margin-top: auto;
    font-size: 13px;
    color: var(--text-dim);
    text-transform: capitalize;
  }
  .card.on .state {
    color: var(--on);
  }
</style>
