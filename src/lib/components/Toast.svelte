<script lang="ts">
  import { toast } from "../toast.svelte";
</script>

{#if toast.msg}
  <div class="toast">
    <span class="ic">📣</span>{toast.msg}
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
    gap: 10px;
    padding: 13px 20px;
    border-radius: 14px;
    background: rgba(16, 22, 31, 0.98);
    box-shadow: 0 20px 50px -18px rgba(0, 0, 0, 0.85), inset 0 1px 0 rgba(255, 255, 255, 0.09);
    color: var(--text);
    font-size: 13.5px;
    font-weight: 600;
    max-width: 90vw;
    animation: ppop 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  .ic {
    font-size: 15px;
  }
  @media (max-width: 640px) {
    .toast {
      bottom: 84px;
    }
  }
</style>
