<script lang="ts">
  // Accessible status: the glyph + word carry the meaning; colour is redundant
  // (Aurora Command recc 5a — never colour alone; red-green CVD safe).
  let { state, label }: { state: "ok" | "idle" | "off" | "warn"; label: string } = $props();
</script>

<span class="status status--{state}">
  {#if state === "ok"}
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7" /></svg>
  {:else if state === "idle"}
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8" /><path d="M12 4a8 8 0 0 0 0 16z" fill="currentColor" stroke="none" /></svg>
  {:else if state === "off"}
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
  {:else}
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5l9 16H3z" /><path d="M12 10v4.5" /><circle cx="12" cy="17.6" r="0.7" fill="currentColor" stroke="none" /></svg>
  {/if}
  {label}
</span>
