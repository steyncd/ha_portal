<script lang="ts">
  import { onMount } from "svelte";
  import {
    connect,
    subscribeEntities,
    callService,
    type Connection,
    type HassEntities,
  } from "./lib/ha";
  import { TOGGLEABLE_DOMAINS } from "./lib/config";
  import EntityCard from "./lib/EntityCard.svelte";

  type Status = "connecting" | "connected" | "error";

  let status = $state<Status>("connecting");
  let error = $state("");
  let entities = $state<HassEntities>({});
  let search = $state("");
  let connection: Connection | undefined;

  // Domains worth surfacing by default; search still spans everything.
  const FEATURED = new Set([
    "light",
    "switch",
    "fan",
    "cover",
    "lock",
    "climate",
    "input_boolean",
    "binary_sensor",
    "sensor",
    "media_player",
  ]);

  const domainOf = (id: string) => id.split(".")[0];

  const nameOf = (e: HassEntities[string]) =>
    (e.attributes.friendly_name as string) ?? e.entity_id;

  const list = $derived.by(() => {
    const q = search.trim().toLowerCase();
    return Object.values(entities)
      .filter((e) => {
        if (q) {
          return (
            e.entity_id.toLowerCase().includes(q) ||
            nameOf(e).toLowerCase().includes(q)
          );
        }
        return FEATURED.has(domainOf(e.entity_id));
      })
      .sort((a, b) => {
        // "On" toggleables float to the top, then alphabetical by name.
        const rank = (e: HassEntities[string]) =>
          TOGGLEABLE_DOMAINS.has(domainOf(e.entity_id)) && e.state === "on"
            ? 0
            : 1;
        const r = rank(a) - rank(b);
        return r !== 0 ? r : nameOf(a).localeCompare(nameOf(b));
      });
  });

  const total = $derived(Object.keys(entities).length);
  const onCount = $derived(
    Object.values(entities).filter(
      (e) => TOGGLEABLE_DOMAINS.has(domainOf(e.entity_id)) && e.state === "on",
    ).length,
  );

  async function toggle(entityId: string) {
    const domain = domainOf(entityId);
    if (!connection || !TOGGLEABLE_DOMAINS.has(domain)) return;
    await callService(connection, domain, "toggle", { entity_id: entityId });
  }

  onMount(async () => {
    try {
      const c = await connect();
      connection = c.connection;
      subscribeEntities(connection, (ents) => {
        entities = ents;
      });
      status = "connected";
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      status = "error";
    }
  });
</script>

<header class="top">
  <div>
    <h1>HA Portal</h1>
    <p class="sub">
      {#if status === "connected"}
        <span class="dot ok"></span>
        {onCount} on · {total} entities
      {:else if status === "connecting"}
        <span class="dot pending"></span> connecting…
      {:else}
        <span class="dot bad"></span> disconnected
      {/if}
    </p>
  </div>
</header>

{#if status === "error"}
  <div class="panel error">
    <strong>Couldn't connect.</strong>
    <p>{error}</p>
    <button onclick={() => location.reload()}>Retry</button>
  </div>
{:else if status === "connecting"}
  <div class="panel">Talking to Home Assistant…</div>
{:else}
  <input
    class="search"
    type="search"
    placeholder="Search all entities…"
    bind:value={search}
    autocomplete="off"
  />

  {#if list.length === 0}
    <div class="panel">No entities match “{search}”.</div>
  {:else}
    <div class="grid">
      {#each list as entity (entity.entity_id)}
        <EntityCard
          {entity}
          toggleable={TOGGLEABLE_DOMAINS.has(domainOf(entity.entity_id))}
          onToggle={() => toggle(entity.entity_id)}
        />
      {/each}
    </div>
  {/if}
{/if}

<style>
  .top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 22px;
  }
  h1 {
    margin: 0;
    font-size: 26px;
    letter-spacing: -0.02em;
  }
  .sub {
    margin: 6px 0 0;
    color: var(--text-dim);
    font-size: 14px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    display: inline-block;
  }
  .dot.ok {
    background: #4cd964;
    box-shadow: 0 0 8px #4cd964;
  }
  .dot.pending {
    background: var(--on);
  }
  .dot.bad {
    background: #ff5b5b;
  }
  .search {
    width: 100%;
    padding: 14px 16px;
    margin-bottom: 20px;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    color: var(--text);
    font-size: 15px;
    outline: none;
  }
  .search:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-soft);
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 12px;
  }
  .panel {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 24px;
    color: var(--text-dim);
  }
  .panel.error {
    border-color: #5a2530;
  }
  .panel.error strong {
    color: var(--text);
  }
  .panel button {
    margin-top: 12px;
    background: var(--accent);
    color: white;
    border: none;
    border-radius: var(--radius-sm);
    padding: 10px 18px;
    font-weight: 600;
  }
</style>
