<script lang="ts">
  // −/+ 15-minute time stepper, writing an input_datetime helper. Phase 4.
  //
  // Steppers rather than a time picker on purpose. Every one of these times is
  // "about half past ten" — nobody arms the house at 22:37 — so 15-minute
  // granularity is the real resolution of the decision, and two taps beat
  // summoning a native picker and scrolling two wheels.
  //
  // THE PORTAL NEVER KEEPS A SECOND COPY. This writes the helper and then reads
  // the helper back; the automation that consumes it stays the single source of
  // truth. A local mirror would drift the moment anything changed the helper
  // from HA's side, and then two screens would disagree about when the house
  // arms.
  import { ha } from "../store.svelte";

  let {
    entity,
    disabled = false,
    step = 15,
  }: {
    entity: string;
    disabled?: boolean;
    /** Minutes per press. */
    step?: number;
  } = $props();

  // HH:MM:SS from the helper; HH:MM is all we show.
  const raw = $derived(ha.state(entity));
  const valid = $derived(!!raw && /^\d{2}:\d{2}/.test(raw));
  const shown = $derived(valid ? raw!.slice(0, 5) : "—");

  function bump(mins: number) {
    if (!valid || disabled) return;
    const [h, m] = raw!.split(":").map(Number);
    // Wrap through midnight rather than clamping: "sunset −15" in December can
    // legitimately push a time across the boundary, and clamping would silently
    // pin it at 23:59.
    const total = (h * 60 + m + mins + 1440) % 1440;
    const hh = String(Math.floor(total / 60)).padStart(2, "0");
    const mm = String(total % 60).padStart(2, "0");
    ha.setDatetime(entity, `${hh}:${mm}:00`);
  }
</script>

<div class="stepper" class:off={disabled}>
  <button
    class="b"
    onclick={() => bump(-step)}
    disabled={disabled || !valid}
    aria-label={`${step} minutes earlier`}
  >−</button>
  <span class="t" aria-live="polite">{shown}</span>
  <button
    class="b"
    onclick={() => bump(step)}
    disabled={disabled || !valid}
    aria-label={`${step} minutes later`}
  >+</button>
</div>

<style>
  .stepper {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    background: var(--fill);
    border-radius: var(--r-control);
    padding: 2px;
  }
  .stepper.off { opacity: 0.45; }
  .b {
    width: 30px;
    height: 30px;
    border-radius: 8px;
    color: var(--tx2);
    font-size: 15px;
    font-weight: 700;
    line-height: 1;
    background: none;
  }
  .b:hover:not(:disabled) { background: var(--fill-strong); color: var(--tx); }
  .b:disabled { opacity: 0.4; }
  .t {
    min-width: 48px;
    text-align: center;
    font-size: 13px;
    font-weight: 700;
    color: var(--tx);
    font-variant-numeric: tabular-nums;
  }
</style>
