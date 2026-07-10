<script lang="ts">
  import { onMount } from "svelte";
  import { ha } from "./lib/store.svelte";
  import Home from "./views/Home.svelte";
  import Energy from "./views/Energy.svelte";
  import Water from "./views/Water.svelte";
  import Security from "./views/Security.svelte";
  import Climate from "./views/Climate.svelte";

  type Tab = "home" | "energy" | "water" | "security" | "climate";

  const TABS: { id: Tab; icon: string; label: string }[] = [
    { id: "home", icon: "🏠", label: "Home" },
    { id: "energy", icon: "⚡", label: "Energy" },
    { id: "water", icon: "💧", label: "Water" },
    { id: "security", icon: "🛡️", label: "Security" },
    { id: "climate", icon: "🌡️", label: "Climate" },
  ];

  let tab = $state<Tab>("home");

  onMount(() => ha.init());
</script>

{#if ha.status === "error"}
  <div class="center">
    <div class="panel">
      <strong>Couldn't connect to Home Assistant</strong>
      <p>{ha.error}</p>
      <button onclick={() => location.reload()}>Retry</button>
    </div>
  </div>
{:else if ha.status === "connecting"}
  <div class="center">
    <div class="spinner"></div>
    <p class="dim">Connecting to Home Assistant…</p>
  </div>
{:else}
  <main class="wrap">
    {#if tab === "home"}<Home />
    {:else if tab === "energy"}<Energy />
    {:else if tab === "water"}<Water />
    {:else if tab === "security"}<Security />
    {:else if tab === "climate"}<Climate />{/if}
  </main>

  <nav>
    <div class="nav-inner">
      {#each TABS as t}
        <button class="tab" class:active={tab === t.id} onclick={() => (tab = t.id)}>
          <span class="ti">{t.icon}</span>
          <span class="tl">{t.label}</span>
        </button>
      {/each}
    </div>
  </nav>
{/if}

<style>
  .center {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 24px;
  }
  .dim {
    color: var(--text-2);
  }
  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--fill-strong);
    border-top-color: var(--brand);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  .panel {
    background: var(--card);
    border: 1px solid var(--error);
    border-radius: var(--r-hero);
    padding: 24px;
    max-width: 440px;
    text-align: center;
  }
  .panel p {
    color: var(--text-2);
    font-size: 14px;
  }
  .panel button {
    margin-top: 8px;
    background: var(--brand);
    color: #fff;
    border-radius: var(--r-tile);
    padding: 10px 20px;
    font-weight: 600;
  }

  nav {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    background: color-mix(in srgb, var(--bg) 88%, transparent);
    backdrop-filter: blur(16px);
    border-top: 1px solid var(--border);
    padding-bottom: env(safe-area-inset-bottom);
    z-index: 10;
  }
  .nav-inner {
    max-width: 560px;
    margin: 0 auto;
    display: flex;
    justify-content: space-around;
    padding: 6px 8px;
  }
  .tab {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    padding: 8px 12px;
    border-radius: 12px;
    color: var(--muted);
    flex: 1;
    transition: color 0.15s ease, background 0.15s ease;
  }
  .tab .ti {
    font-size: 20px;
    filter: grayscale(0.6) opacity(0.65);
    transition: filter 0.15s ease;
  }
  .tab .tl {
    font-size: 10.5px;
    font-weight: 600;
    letter-spacing: 0.2px;
  }
  .tab.active {
    color: var(--brand);
    background: color-mix(in srgb, var(--brand) 12%, transparent);
  }
  .tab.active .ti {
    filter: none;
  }
</style>
