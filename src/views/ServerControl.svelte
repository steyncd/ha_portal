<script lang="ts">
  // Server control — restart HA core and reload individual YAML domains without
  // opening Home Assistant. Restart is guarded by an inline two-step confirm.
  import { ha } from "../lib/store.svelte";
  import { toast } from "../lib/toast.svelte";
  import Icon from "../lib/components/Icon.svelte";

  let confirmRestart = $state(false);
  let busy = $state("");

  const RELOADS = [
    { domain: "automation", label: "Automations" },
    { domain: "script", label: "Scripts" },
    { domain: "scene", label: "Scenes" },
    { domain: "template", label: "Templates" },
    { domain: "input_boolean", label: "Helpers" },
  ];

  async function reload(domain: string, label: string) {
    busy = domain;
    try {
      await ha.reloadDomain(domain);
      toast.show(`${label} reloaded`);
    } catch {
      toast.show(`Couldn't reload ${label.toLowerCase()}`);
    } finally {
      busy = "";
    }
  }

  async function reloadAll() {
    busy = "all";
    try {
      await ha.reloadAll();
      toast.show("All YAML reloaded");
    } catch {
      toast.show("Reload failed");
    } finally {
      busy = "";
    }
  }

  async function restart() {
    if (!confirmRestart) { confirmRestart = true; return; }
    confirmRestart = false;
    busy = "restart";
    try {
      await ha.restart();
      toast.show("Home Assistant is restarting…");
    } catch {
      toast.show("Restart failed");
    } finally {
      busy = "";
    }
  }

  const uptime = $derived(ha.state("sensor.uptime") ?? ha.state("sensor.home_assistant_uptime"));
  const version = $derived(ha.state("sensor.home_assistant_version") ?? ha.state("update.home_assistant_core_update"));
</script>

<div class="wrap">
  <section class="card">
    <div class="ch"><span class="lb">Reload configuration</span></div>
    <p class="hint">Apply YAML edits without a full restart. Fast and safe.</p>
    <div class="grid">
      <button class="rbtn wide" onclick={reloadAll} disabled={busy === "all"}>
        <Icon name="sliders" size={16} /> {busy === "all" ? "Reloading…" : "Reload all YAML"}
      </button>
      {#each RELOADS as r}
        <button class="rbtn" onclick={() => reload(r.domain, r.label)} disabled={busy === r.domain}>
          {busy === r.domain ? "…" : r.label}
        </button>
      {/each}
    </div>
  </section>

  <section class="card danger">
    <div class="ch"><span class="lb">Restart core</span></div>
    <p class="hint">
      Restarts Home Assistant. Automations and the dashboard drop for ~30–60s.
      {#if version}Running {version}.{/if}
      {#if uptime}Up since {uptime}.{/if}
    </p>
    <div class="rrow">
      <button class="rbtn restart" class:armed={confirmRestart} onclick={restart} disabled={busy === "restart"}>
        {#if busy === "restart"}Restarting…{:else if confirmRestart}Confirm restart{:else}Restart Home Assistant{/if}
      </button>
      {#if confirmRestart}<button class="rbtn ghost" onclick={() => (confirmRestart = false)}>Cancel</button>{/if}
    </div>
  </section>
</div>

<style>
  .wrap { display: flex; flex-direction: column; gap: 14px; max-width: 720px; margin: 0 auto; width: 100%; }
  .card { background: var(--card, rgba(255, 255, 255, 0.04)); border: 1px solid var(--line, rgba(255, 255, 255, 0.08)); border-radius: 18px; padding: 18px; }
  .card.danger { border-color: color-mix(in srgb, var(--danger, #ff5a5a) 40%, transparent); }
  .ch { margin-bottom: 4px; }
  .lb { font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); font-weight: 700; }
  .hint { font-size: 13px; color: var(--muted); margin: 4px 0 14px; line-height: 1.45; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; }
  .rbtn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 12px 14px; border-radius: 12px; background: rgba(255, 255, 255, 0.06); border: 1px solid var(--line, rgba(255, 255, 255, 0.08)); color: var(--text); font-weight: 600; font-size: 13.5px; transition: background 0.15s, border-color 0.15s; }
  .rbtn:hover:not(:disabled) { background: rgba(255, 255, 255, 0.1); }
  .rbtn:disabled { opacity: 0.55; }
  .rbtn.wide { grid-column: 1 / -1; background: var(--grad, rgba(110, 168, 254, 0.18)); color: #0b1017; }
  .rrow { display: flex; gap: 10px; align-items: center; }
  .rbtn.restart { border-color: color-mix(in srgb, var(--danger, #ff5a5a) 45%, transparent); color: var(--danger, #ff5a5a); }
  .rbtn.restart.armed { background: var(--danger, #ff5a5a); color: #fff; border-color: var(--danger, #ff5a5a); }
  .rbtn.ghost { background: transparent; }
</style>
