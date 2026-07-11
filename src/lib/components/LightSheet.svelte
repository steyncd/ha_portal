<script lang="ts">
  import { ha } from "../store.svelte";
  import { lightSheet } from "../lightSheet.svelte";
  import Toggle from "./Toggle.svelte";

  const id = $derived(lightSheet.id);
  const on = $derived(id ? ha.isOn(id) : false);

  // brightness 0-255 → %
  const brightPct = $derived.by(() => {
    if (!id) return 100;
    const b = ha.attr(id, "brightness") as number | undefined;
    if (b == null) return on ? 100 : 0;
    return Math.round((b / 255) * 100);
  });

  let dragPct = $state<number | null>(null);
  const shownPct = $derived(dragPct ?? brightPct);

  const SWATCHES: { c: string; rgb: [number, number, number] }[] = [
    { c: "#fff4d6", rgb: [255, 244, 214] },
    { c: "#ffd9a0", rgb: [255, 217, 160] },
    { c: "#ffffff", rgb: [255, 255, 255] },
    { c: "#a78bfa", rgb: [167, 139, 250] },
    { c: "#38bdf8", rgb: [56, 189, 248] },
    { c: "#34d399", rgb: [52, 211, 153] },
    { c: "#fb7185", rgb: [251, 113, 133] },
    { c: "#fbbf24", rgb: [251, 191, 36] },
  ];

  const isLight = $derived(id?.startsWith("light.") ?? false);

  function setBright(e: Event) {
    const v = Number((e.target as HTMLInputElement).value);
    dragPct = v;
    if (id) ha.lightSet(id, { brightness_pct: v });
  }
  function pick(rgb: [number, number, number]) {
    if (id && isLight) ha.lightSet(id, { rgb_color: rgb });
  }
</script>

{#if id}
  <div class="scrim" onclick={() => lightSheet.close()} role="presentation">
    <div class="sheet" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
      <div class="head">
        <div class="who">
          <span class="orb">💡</span>
          <div>
            <div class="nm">{lightSheet.name}</div>
            <div class="st">{on ? "On" : "Off"} · {shownPct}%</div>
          </div>
        </div>
        <Toggle {on} onchange={() => id && ha.toggle(id)} />
      </div>

      <div class="block">
        <div class="row"><span class="lbl">Brightness</span><span class="pct">{shownPct}%</span></div>
        <input type="range" min="1" max="100" value={shownPct} oninput={setBright} disabled={!isLight} />
        {#if !isLight}<div class="note">This is a switch — on/off only.</div>{/if}
      </div>

      {#if isLight}
        <div class="lbl" style="margin-bottom:11px">Colour</div>
        <div class="swatches">
          {#each SWATCHES as s}
            <button class="sw" style="background:{s.c}" onclick={() => pick(s.rgb)} aria-label="colour"></button>
          {/each}
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 62;
    background: rgba(4, 8, 13, 0.62);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    animation: pfade 0.16s ease;
  }
  .sheet {
    width: min(430px, 94vw);
    border-radius: 20px;
    background: rgba(15, 21, 30, 0.99);
    box-shadow: 0 30px 80px -20px rgba(0, 0, 0, 0.85), inset 0 1px 0 rgba(255, 255, 255, 0.09);
    padding: 22px;
    animation: ppop 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 20px;
  }
  .who {
    display: flex;
    align-items: center;
    gap: 13px;
    min-width: 0;
  }
  .orb {
    width: 46px;
    height: 46px;
    flex-shrink: 0;
    border-radius: 14px;
    display: grid;
    place-items: center;
    font-size: 21px;
    background: color-mix(in srgb, var(--warning) 30%, transparent);
    box-shadow: 0 0 22px color-mix(in srgb, var(--warning) 45%, transparent);
  }
  .nm {
    font-size: 16px;
    font-weight: 800;
  }
  .st {
    font-size: 11.5px;
    color: var(--muted);
  }
  .block {
    margin-bottom: 20px;
  }
  .row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 10px;
  }
  .lbl {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .pct {
    font-size: 12.5px;
    font-weight: 800;
    color: var(--warning);
  }
  input[type="range"] {
    width: 100%;
    height: 8px;
    cursor: pointer;
    accent-color: var(--warning);
  }
  .note {
    font-size: 11px;
    color: var(--muted-2);
    margin-top: 8px;
  }
  .swatches {
    display: flex;
    gap: 11px;
    flex-wrap: wrap;
  }
  .sw {
    width: 38px;
    height: 38px;
    border-radius: 50%;
    cursor: pointer;
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.2);
  }
  .sw:hover {
    box-shadow: 0 0 0 2px #fff;
  }
</style>
