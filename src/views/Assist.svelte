<script lang="ts">
  // Assist — two modes over one input, because they answer different tenses.
  //
  // "House" is HA's conversation agent: it knows the present and can act.
  // "History" is the BigQuery warehouse: it knows every day since we started
  // recording and can act on nothing. Neither can answer the other's questions,
  // and the failure is silent if you mix them — ask HA about July and it will
  // confidently tell you about right now.
  //
  // Modes are explicit rather than auto-routed. A classifier that guesses wrong
  // gives you a plausible answer to a question you didn't ask, which is worse
  // than a tab you have to press.
  import { ha } from "../lib/store.svelte";
  import { getFunctions, httpsCallable } from "firebase/functions";
  import { app } from "../lib/firebase";
  import { tick } from "svelte";

  type Row = Record<string, string | number | null>;
  type Msg = {
    role: "me" | "ha";
    text: string;
    // History answers carry their working: the SQL that ran and the rows it
    // returned, so a number can always be checked rather than trusted.
    sql?: string;
    rows?: Row[];
    title?: string;
    unit?: string;
    x?: string;
    y?: string[];
    chart?: "line" | "bar" | "none";
  };

  type Mode = "house" | "history";
  let mode = $state<Mode>("house");
  let msgs = $state<Msg[]>([]);
  let input = $state("");
  let busy = $state(false);
  let convId: string | null = null;
  let scroller: HTMLDivElement | undefined = $state();
  let showSql = $state<Record<number, boolean>>({});

  const SUGGESTIONS: Record<Mode, string[]> = {
    house: ["Turn off all the lights", "Is the alarm armed?", "What's the battery level?", "Close the garage door"],
    history: [
      "What did we spend on electricity last month?",
      "How low did the battery get this week?",
      "Which month did the borehole pump the most?",
      "Every day the tank went below 30%",
    ],
  };

  const mockMode =
    new URLSearchParams(location.search).get("mock") === "1" || import.meta.env.VITE_MOCK === "1";

  const MOCK_ANSWER = {
    answer: "You spent R842 on grid electricity in July, R96 more than June. The 18th was the worst day at R58.",
    rows: [
      { date: "2026-07-14", energy_cost: 24.1, grid_import_kwh: 8.4 },
      { date: "2026-07-15", energy_cost: 31.7, grid_import_kwh: 11.2 },
      { date: "2026-07-16", energy_cost: 19.8, grid_import_kwh: 6.9 },
      { date: "2026-07-17", energy_cost: 44.3, grid_import_kwh: 15.6 },
      { date: "2026-07-18", energy_cost: 58.0, grid_import_kwh: 20.4 },
      { date: "2026-07-19", energy_cost: 27.5, grid_import_kwh: 9.6 },
      { date: "2026-07-20", energy_cost: 22.9, grid_import_kwh: 8.0 },
    ] as Row[],
    sql: "SELECT date, energy_cost, grid_import_kwh\nFROM `home.daily`\nWHERE date BETWEEN '2026-07-01' AND '2026-07-31'\nORDER BY date\nLIMIT 500",
    title: "Grid electricity cost, July",
    unit: "R",
    x: "date",
    y: ["energy_cost"],
    chart: "line" as const,
  };

  const INTRO: Record<Mode, { t: string; s: string }> = {
    house: { t: "Ask the house", s: "Control devices and check what's happening right now." },
    history: { t: "Ask the history", s: "Questions about days, weeks and months gone by." },
  };

  function setMode(m: Mode) {
    if (m === mode) return;
    mode = m;
    // Threads don't mix: the two agents share no context, so carrying replies
    // across would imply a continuity that doesn't exist.
    msgs = [];
    convId = null;
    showSql = {};
  }

  async function send(text: string) {
    const t = text.trim();
    if (!t || busy) return;
    input = "";
    msgs = [...msgs, { role: "me", text: t }];
    busy = true;
    await tick();
    scroller?.scrollTo({ top: scroller.scrollHeight });

    if (mode === "house") {
      const { reply, conversationId } = await ha.assist(t, convId);
      convId = conversationId;
      msgs = [...msgs, { role: "ha", text: reply }];
    } else if (mockMode) {
      // Same shape the Function returns, so ?mock=1 exercises the result card
      // (table, sparkline, query reveal) without a warehouse or a sign-in.
      await new Promise((r) => setTimeout(r, 400));
      msgs = [...msgs, { role: "ha", ...MOCK_ANSWER, text: MOCK_ANSWER.answer }];
    } else {
      try {
        const fn = httpsCallable(getFunctions(app, "us-central1"), "askWarehouse");
        const r = (await fn({ question: t })).data as {
          answer: string; rows: Row[]; sql: string; title: string;
          unit: string; x: string; y: string[]; chart: "line" | "bar" | "none";
        };
        msgs = [...msgs, { role: "ha", text: r.answer || "No answer for that.", ...r }];
      } catch (e) {
        const m = (e as { message?: string })?.message || "Couldn't reach the history.";
        msgs = [...msgs, { role: "ha", text: m }];
      }
    }

    busy = false;
    await tick();
    scroller?.scrollTo({ top: scroller.scrollHeight, behavior: "smooth" });
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
  }

  // Sparkline over the first numeric y column. Deliberately tiny: the point is
  // the shape of the answer, not a chart to study — the Energy and Water views
  // already do proper charts.
  function spark(rows: Row[], col: string): string {
    const vals = rows.map((r) => Number(r[col])).filter((n) => Number.isFinite(n));
    if (vals.length < 2) return "";
    const lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo || 1;
    const W = 260, H = 40;
    return vals
      .map((v, i) => `${(i / (vals.length - 1)) * W},${H - ((v - lo) / span) * H}`)
      .join(" ");
  }

  function cols(rows: Row[]): string[] {
    return rows.length ? Object.keys(rows[0]) : [];
  }
  function fmt(v: string | number | null): string {
    if (v === null || v === undefined) return "—";
    return typeof v === "number" ? String(Math.round(v * 100) / 100) : String(v);
  }
</script>

<div class="wrap">
  <div class="modes" role="tablist" aria-label="What to ask">
    <button class="mode" class:on={mode === "house"} role="tab" aria-selected={mode === "house"} onclick={() => setMode("house")}>House · now</button>
    <button class="mode" class:on={mode === "history"} role="tab" aria-selected={mode === "history"} onclick={() => setMode("history")}>History · then</button>
  </div>

  <div class="thread" bind:this={scroller}>
    {#if !msgs.length}
      <div class="intro">
        <p class="t">{INTRO[mode].t}</p>
        <p class="s">{INTRO[mode].s}</p>
        <div class="sugs">
          {#each SUGGESTIONS[mode] as s (s)}<button class="sug" onclick={() => send(s)}>{s}</button>{/each}
        </div>
      </div>
    {/if}

    {#each msgs as m, i (i)}
      <div class="msg {m.role}">{m.text}</div>

      {#if m.role === "ha" && m.rows?.length}
        <div class="card">
<!-- &nbsp; not a plain space: Svelte trims whitespace between an expression
               and an element, so the gap before the unit disappears without it. -->
          {#if m.title}<p class="ct">{m.title}{#if m.unit}&nbsp;<span class="cu">({m.unit})</span>{/if}</p>{/if}

          {#if m.chart !== "none" && m.y?.length && spark(m.rows, m.y[0])}
            <svg class="spark" viewBox="0 0 260 40" preserveAspectRatio="none" aria-hidden="true">
              <polyline points={spark(m.rows, m.y[0])} fill="none" stroke="var(--acc)" stroke-width="2" stroke-linejoin="round" />
            </svg>
          {/if}

          <!-- Scrolls inside its own box: a wide result must never make the page
               scroll sideways. -->
          <div class="tw">
            <table>
              <thead>
                <tr>{#each cols(m.rows) as c (c)}<th>{c}</th>{/each}</tr>
              </thead>
              <tbody>
                {#each m.rows.slice(0, 12) as r, ri (ri)}
                  <tr>{#each cols(m.rows) as c (c)}<td>{fmt(r[c])}</td>{/each}</tr>
                {/each}
              </tbody>
            </table>
          </div>
          {#if m.rows.length > 12}<p class="more">{m.rows.length - 12} more rows</p>{/if}

          <button class="sqlbtn" onclick={() => (showSql = { ...showSql, [i]: !showSql[i] })}>
            {showSql[i] ? "Hide" : "Show"} the query
          </button>
          {#if showSql[i]}<pre class="sql">{m.sql}</pre>{/if}
        </div>
      {/if}
    {/each}

    {#if busy}<div class="msg ha typing">•••</div>{/if}
  </div>

  <div class="composer">
    <input
      class="in"
      placeholder={mode === "house" ? "Message Assist…" : "Ask about a day, week or month…"}
      bind:value={input}
      onkeydown={onKey}
      disabled={busy}
    />
    <button class="send" onclick={() => send(input)} disabled={busy || !input.trim()} aria-label="Send">↑</button>
  </div>
</div>

<style>
  .wrap { display: flex; flex-direction: column; gap: 12px; max-width: 720px; margin: 0 auto; width: 100%; height: calc(100vh - 220px); min-height: 360px; }

  .modes { display: flex; gap: 6px; padding: 4px; border-radius: var(--r-ctl); background: var(--s1); box-shadow: inset 0 0 0 1px var(--line); }
  .mode { flex: 1; padding: 8px 12px; border-radius: 8px; background: transparent; color: var(--mut); font-size: 12.5px; font-weight: 700; }
  .mode.on { background: var(--fill-strong, rgba(255, 255, 255, 0.08)); color: var(--tx); }

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

  .card { align-self: flex-start; width: 100%; max-width: 100%; padding: 12px 14px; border-radius: var(--r-card); background: var(--s1); box-shadow: inset 0 0 0 1px var(--line); }
  .ct { font-size: 12.5px; font-weight: 700; color: var(--tx2); margin: 0 0 8px; }
  .cu { font-weight: 600; color: var(--mut); }
  .spark { display: block; width: 100%; height: 40px; margin-bottom: 10px; }
  .tw { overflow-x: auto; }
  table { border-collapse: collapse; font-size: 12px; font-variant-numeric: tabular-nums; }
  th, td { padding: 4px 10px 4px 0; text-align: left; white-space: nowrap; }
  th { color: var(--mut); font-weight: 700; }
  td { color: var(--tx); }
  .more { font-size: 11.5px; color: var(--mut); margin: 6px 0 0; }
  .sqlbtn { margin-top: 10px; padding: 5px 10px; border-radius: var(--r-ctl); background: var(--fill, rgba(255, 255, 255, 0.05)); color: var(--mut); font-size: 11.5px; font-weight: 700; }
  .sqlbtn:hover { color: var(--tx2); }
  .sql { margin: 8px 0 0; padding: 10px; border-radius: var(--r-ctl); background: var(--bg); color: var(--tx2); font-size: 11.5px; line-height: 1.5; overflow-x: auto; white-space: pre; }

  .composer { display: flex; gap: 10px; align-items: center; }
  .in { flex: 1; padding: 13px 16px; border-radius: 14px; background: rgba(255, 255, 255, 0.05); border: 1px solid var(--line, rgba(255, 255, 255, 0.08)); color: var(--text); font-size: 14px; }
  .send { width: 44px; height: 44px; flex: none; border-radius: 12px; background: var(--grad, rgba(110, 168, 254, 0.3)); color: #0b1017; font-size: 18px; font-weight: 700; }
  .send:disabled { opacity: 0.45; }
</style>
