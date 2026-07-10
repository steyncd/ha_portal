<script lang="ts">
  import { onMount } from "svelte";
  import { ha } from "./lib/store.svelte";
  import Home from "./views/Home.svelte";
  import Energy from "./views/Energy.svelte";
  import Water from "./views/Water.svelte";
  import Climate from "./views/Climate.svelte";
  import Security from "./views/Security.svelte";
  import Traffic from "./views/Traffic.svelte";
  import System from "./views/System.svelte";

  type Tab = "home" | "energy" | "water" | "climate" | "security" | "traffic" | "system";

  const TABS: { id: Tab; icon: string; label: string }[] = [
    { id: "home", icon: "🏠", label: "Home" },
    { id: "energy", icon: "⚡", label: "Energy" },
    { id: "water", icon: "💧", label: "Water" },
    { id: "climate", icon: "🌡️", label: "Climate" },
    { id: "security", icon: "🛡️", label: "Security" },
    { id: "traffic", icon: "🚗", label: "Traffic" },
    { id: "system", icon: "🖥️", label: "System" },
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
  <header class="topbar">
    <div class="bar-inner">
      <div class="brand">
        <span class="logo">◆</span>
        HA Portal
        <span class="live" title="Live"></span>
      </div>
      <nav class="tabs">
        {#each TABS as t}
          <button class="tab" class:active={tab === t.id} onclick={() => (tab = t.id)}>
            <span class="ti">{t.icon}</span><span class="tl">{t.label}</span>
          </button>
        {/each}
      </nav>
    </div>
  </header>

  <main class="wrap">
    {#if tab === "home"}<Home />
    {:else if tab === "energy"}<Energy />
    {:else if tab === "water"}<Water />
    {:else if tab === "climate"}<Climate />
    {:else if tab === "security"}<Security />
    {:else if tab === "traffic"}<Traffic />
    {:else if tab === "system"}<System />{/if}
  </main>
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

  .topbar {
    position: sticky;
    top: 0;
    z-index: 20;
    background: color-mix(in srgb, var(--bg) 85%, transparent);
    backdrop-filter: blur(18px);
    border-bottom: 1px solid var(--border);
    padding-top: env(safe-area-inset-top);
  }
  .bar-inner {
    max-width: 1240px;
    margin: 0 auto;
    padding: 10px 12px;
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 700;
    font-size: 15px;
    letter-spacing: -0.2px;
    flex-shrink: 0;
  }
  .logo {
    color: var(--brand);
    font-size: 13px;
  }
  .live {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--success);
    box-shadow: 0 0 8px var(--success);
  }
  .tabs {
    display: flex;
    gap: 4px;
    overflow-x: auto;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
  }
  .tabs::-webkit-scrollbar {
    display: none;
  }
  .tab {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 8px 14px;
    border-radius: var(--r-pill);
    color: var(--text-2);
    white-space: nowrap;
    font-size: 13px;
    font-weight: 600;
    transition: background 0.15s ease, color 0.15s ease;
  }
  .tab:hover {
    color: var(--text);
  }
  .tab .ti {
    font-size: 15px;
    filter: grayscale(0.5) opacity(0.7);
  }
  .tab.active {
    color: #fff;
    background: linear-gradient(135deg, color-mix(in srgb, var(--brand-2) 32%, transparent), color-mix(in srgb, var(--brand) 32%, transparent));
    box-shadow:
      inset 0 0 0 1px color-mix(in srgb, var(--brand) 45%, transparent),
      0 6px 20px -8px var(--glow);
  }
  .tab.active .ti {
    filter: none;
  }
</style>
