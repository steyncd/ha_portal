<script lang="ts">
  // Assist chat — talk to Home Assistant's conversation agent from the portal.
  // Keeps the conversation_id so follow-ups stay in context.
  import { ha } from "../lib/store.svelte";
  import { tick } from "svelte";

  type Msg = { role: "me" | "ha"; text: string };
  let msgs = $state<Msg[]>([]);
  let input = $state("");
  let busy = $state(false);
  let convId: string | null = null;
  let scroller: HTMLDivElement | undefined = $state();

  const SUGGESTIONS = ["Turn off all the lights", "Is the alarm armed?", "What's the battery level?", "Close the garage door"];

  async function send(text: string) {
    const t = text.trim();
    if (!t || busy) return;
    input = "";
    msgs = [...msgs, { role: "me", text: t }];
    busy = true;
    await tick();
    scroller?.scrollTo({ top: scroller.scrollHeight });
    const { reply, conversationId } = await ha.assist(t, convId);
    convId = conversationId;
    msgs = [...msgs, { role: "ha", text: reply }];
    busy = false;
    await tick();
    scroller?.scrollTo({ top: scroller.scrollHeight, behavior: "smooth" });
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
  }
</script>

<div class="wrap">
  <div class="thread" bind:this={scroller}>
    {#if !msgs.length}
      <div class="intro">
        <p class="t">Ask Home Assistant anything</p>
        <p class="s">Control devices and query state in plain language.</p>
        <div class="sugs">
          {#each SUGGESTIONS as s}<button class="sug" onclick={() => send(s)}>{s}</button>{/each}
        </div>
      </div>
    {/if}
    {#each msgs as m}
      <div class="msg {m.role}">{m.text}</div>
    {/each}
    {#if busy}<div class="msg ha typing">•••</div>{/if}
  </div>

  <div class="composer">
    <input class="in" placeholder="Message Assist…" bind:value={input} onkeydown={onKey} disabled={busy} />
    <button class="send" onclick={() => send(input)} disabled={busy || !input.trim()} aria-label="Send">↑</button>
  </div>
</div>

<style>
  .wrap { display: flex; flex-direction: column; gap: 12px; max-width: 720px; margin: 0 auto; width: 100%; height: calc(100vh - 220px); min-height: 360px; }
  .thread { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; padding: 4px; }
  .intro { margin: auto; text-align: center; padding: 20px; }
  .intro .t { font-size: 17px; font-weight: 700; color: var(--text); }
  .intro .s { font-size: 13px; color: var(--muted); margin-top: 4px; }
  .sugs { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-top: 16px; }
  .sug { padding: 9px 14px; border-radius: 999px; background: rgba(255, 255, 255, 0.05); border: 1px solid var(--line, rgba(255, 255, 255, 0.08)); color: var(--text); font-size: 13px; }
  .sug:hover { background: rgba(255, 255, 255, 0.1); }
  .msg { max-width: 82%; padding: 11px 14px; border-radius: 16px; font-size: 14px; line-height: 1.45; white-space: pre-wrap; word-break: break-word; }
  .msg.me { align-self: flex-end; background: var(--grad, rgba(110, 168, 254, 0.25)); color: #0b1017; border-bottom-right-radius: 5px; }
  .msg.ha { align-self: flex-start; background: var(--card, rgba(255, 255, 255, 0.06)); border: 1px solid var(--line, rgba(255, 255, 255, 0.08)); color: var(--text); border-bottom-left-radius: 5px; }
  .msg.typing { letter-spacing: 2px; color: var(--muted); }
  .composer { display: flex; gap: 10px; align-items: center; }
  .in { flex: 1; padding: 13px 16px; border-radius: 14px; background: rgba(255, 255, 255, 0.05); border: 1px solid var(--line, rgba(255, 255, 255, 0.08)); color: var(--text); font-size: 14px; }
  .send { width: 44px; height: 44px; flex: none; border-radius: 12px; background: var(--grad, rgba(110, 168, 254, 0.3)); color: #0b1017; font-size: 18px; font-weight: 700; }
  .send:disabled { opacity: 0.45; }
</style>
