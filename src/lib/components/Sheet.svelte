<script lang="ts">
  // Generalised bottom sheet — Phase 1.3.
  //
  // This is what makes 37 views survivable on a phone: every drill-down opens
  // here instead of navigating away, so you never lose your place. LightSheet
  // was the prototype; this is the reusable version with the two things it was
  // missing — Escape and swipe-down.
  //
  // Drag is initiated from the grab handle / header ONLY. If the whole sheet
  // were draggable, a downward flick meant for the scrollable body would
  // dismiss the sheet instead of scrolling it — the single most common bug in
  // hand-rolled sheets.
  import type { Snippet } from "svelte";

  let {
    open = false,
    title = "",
    subtitle = "",
    onclose,
    children,
    actions,
  }: {
    open?: boolean;
    title?: string;
    subtitle?: string;
    onclose: () => void;
    /** Sheet body. */
    children?: Snippet;
    /** Optional trailing header content (a toggle, a menu). */
    actions?: Snippet;
  } = $props();

  let sheetEl = $state<HTMLElement>();
  let dragY = $state(0);
  let dragging = $state(false);
  let startY = 0;
  let restoreFocus: HTMLElement | null = null;

  const DISMISS_PX = 90;

  function close() {
    dragY = 0;
    dragging = false;
    onclose();
  }

  // Escape + focus handling. Attached while open only.
  $effect(() => {
    if (!open) return;
    restoreFocus = document.activeElement as HTMLElement | null;
    // Focus the sheet so Escape reaches it and screen readers announce it.
    queueMicrotask(() => sheetEl?.focus());

    const onkey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
      }
    };
    window.addEventListener("keydown", onkey, true);

    // Don't let the page behind scroll while a sheet is up.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onkey, true);
      document.body.style.overflow = prev;
      restoreFocus?.focus?.();
    };
  });

  function grabStart(e: PointerEvent) {
    dragging = true;
    startY = e.clientY;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  }
  function grabMove(e: PointerEvent) {
    if (!dragging) return;
    // Downward only — dragging up shouldn't stretch the sheet.
    dragY = Math.max(0, e.clientY - startY);
  }
  function grabEnd() {
    if (!dragging) return;
    dragging = false;
    if (dragY > DISMISS_PX) close();
    else dragY = 0;
  }
</script>

{#if open}
  <div class="scrim" onclick={close} role="presentation"></div>
  <div
    class="sheet"
    class:dragging
    style="--dy: {dragY}px"
    bind:this={sheetEl}
    role="dialog"
    aria-modal="true"
    aria-label={title || "Details"}
    tabindex="-1"
  >
    <!-- Drag affordance + drag origin. Also a real button so keyboard users can
         dismiss without hunting for Escape. -->
    <div class="grabzone">
      <button
        class="grab"
        onclick={close}
        onpointerdown={grabStart}
        onpointermove={grabMove}
        onpointerup={grabEnd}
        onpointercancel={grabEnd}
        aria-label="Close"
      >
        <span class="bar"></span>
      </button>
      {#if title}
        <div class="head">
          <div class="ttl">
            <div class="t">{title}</div>
            {#if subtitle}<div class="s">{subtitle}</div>{/if}
          </div>
          {#if actions}<div class="act">{@render actions()}</div>{/if}
        </div>
      {/if}
    </div>

    <div class="body">
      {#if children}{@render children()}{/if}
    </div>
  </div>
{/if}

<style>
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 58;
    background: rgba(0, 0, 0, 0.55);
    /* The background IS frozen behind this, so blur is legitimate here —
       unlike persistent chrome, where it was removed. */
    backdrop-filter: blur(4px);
    animation: fade 0.16s ease;
  }
  .sheet {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 59;
    max-height: 88dvh;
    display: flex;
    flex-direction: column;
    background: var(--s1);
    border-top: 1px solid var(--line);
    border-radius: var(--r-card) var(--r-card) 0 0;
    box-shadow: 0 -20px 60px -24px rgba(0, 0, 0, 0.7);
    animation: up 0.22s cubic-bezier(0.2, 0.8, 0.2, 1);
    /* transform only, ≤300ms — brief rule 4 */
    transition: transform 0.18s cubic-bezier(0.2, 0.8, 0.2, 1);
    /* Drag offset arrives as --dy so the desktop centring can compose with it
       instead of being clobbered by an inline transform. */
    --dy: 0px;
    transform: translateY(var(--dy));
  }
  /* While the finger is down, follow it exactly — no easing lag. */
  .sheet.dragging { transition: none; }

  /* On desktop it reads better as a centred panel than a full-width bar. */
  @media (min-width: 821px) {
    .sheet {
      left: 50%;
      right: auto;
      width: min(560px, 94vw);
      bottom: 24px;
      border-radius: var(--r-card);
      border: 1px solid var(--line);
      transform: translateX(-50%) translateY(var(--dy));
    }
    @keyframes up-desktop { from { transform: translateX(-50%) translateY(100%); } }
    .sheet { animation-name: up-desktop; }
  }

  .grabzone { flex: none; }
  .grab { touch-action: none; cursor: grab; }
  .grab:active { cursor: grabbing; }
  .grab {
    display: block;
    width: 100%;
    padding: 10px 0 6px;
    background: none;
  }
  .grab .bar {
    display: block;
    width: 38px;
    height: 4px;
    margin: 0 auto;
    border-radius: 2px;
    background: var(--mut);
    opacity: 0.5;
  }
  .head {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 4px 18px 12px;
    border-bottom: 1px solid var(--line);
  }
  .ttl { flex: 1; min-width: 0; }
  .t { font-size: 15px; font-weight: 700; color: var(--tx); }
  .s { font-size: 12px; color: var(--mut); margin-top: 2px; }
  .act { flex: none; }

  .body {
    overflow-y: auto;
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
    padding: 14px 18px calc(18px + env(safe-area-inset-bottom));
  }

  @keyframes up { from { transform: translateY(100%); } }
  @keyframes fade { from { opacity: 0; } }
  :global(.reduce-motion) .sheet,
  :global(.reduce-motion) .scrim { animation: none; }
</style>
