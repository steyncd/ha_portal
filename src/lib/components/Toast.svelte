<script lang="ts">
  import { toast } from "../toast.svelte";
</script>

{#if toast.msg}
  <div class="toast" role="status" aria-live="polite">
    <span class="msg">{toast.msg}</span>
    {#if toast.action}
      <button class="undo" onclick={() => toast.fire()}>{toast.action.label}</button>
      <!-- The drain bar is the only reason the 5s window is legible: without it
           you can't tell whether undo is still available. -->
      <span class="drain" style="--p: {toast.progress}" aria-hidden="true"></span>
    {/if}
  </div>
{/if}

<style>
  .toast {
    position: fixed;
    left: 50%;
    bottom: 28px;
    transform: translateX(-50%);
    z-index: 80;
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 12px 16px;
    border-radius: var(--r-ctl);
    background: var(--s2);
    box-shadow: inset 0 0 0 1px var(--line), 0 20px 50px -18px rgba(0, 0, 0, 0.85);
    color: var(--tx);
    font-size: 13.5px;
    font-weight: 600;
    max-width: 90vw;
    overflow: hidden;
    animation: ppop 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  .msg { min-width: 0; }
  .undo {
    flex: none;
    padding: 5px 12px;
    border-radius: var(--r-ctl);
    background: var(--wash);
    color: var(--acc);
    font-size: 12.5px;
    font-weight: 800;
  }
  .undo:hover { background: color-mix(in srgb, var(--acc) 22%, transparent); }
  .drain {
    position: absolute;
    left: 0;
    bottom: 0;
    height: 2px;
    width: 100%;
    background: var(--acc);
    transform-origin: left;
    transform: scaleX(var(--p, 0));
    /* transform only — matches the 100ms store tick, so it reads as continuous */
    transition: transform 0.1s linear;
  }
  :global(.reduce-motion) .drain { transition: none; }
  @media (max-width: 640px) {
    /* clear the mobile tab bar */
    .toast { bottom: 84px; }
  }
</style>
