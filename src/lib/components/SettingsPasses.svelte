<script lang="ts">
  // Settings › Account › Visitor passes. Design answer §D.3.
  //
  // Scoped to CAPABILITIES, not screens. The list of verbs is the security
  // model; the nav is not. And the brief generates from the granted scopes, so
  // the pass and its instructions are one object — a brief explaining how to
  // disarm the alarm to somebody without alarm.disarm is worse than none, because
  // they will try, fail, and phone you at 22:00.
  import { onMount } from "svelte";
  import { ha } from "../store.svelte";
  import { toast } from "../toast.svelte";
  import {
    passes, SCOPES, NEVER_GRANTABLE, defaultScopes, houseSitterBrief, type Scope, type Pass,
  } from "../passes.svelte";
  import SettingRow from "./SettingRow.svelte";

  let name = $state("");
  let hours = $state(48);
  let chosen = $state<Scope[]>(defaultScopes());
  let brief = $state<string | null>(null);

  onMount(() => { passes.load(); });

  const when = (ms: number) =>
    new Date(ms).toLocaleString("en-ZA", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });

  const toggle = (s: Scope) =>
    (chosen = chosen.includes(s) ? chosen.filter((x) => x !== s) : [...chosen, s]);

  const facts = () => ({
    // input_select, not sensor — same object_id, wrong domain. There is also
    // sensor.next_bin_day ("Today"), which answers a different question: this
    // one is which day bins go out, not when the next one is.
    binDay: ha.state("input_select.bin_collection_day") ?? null,
    poolSchedule: "07:00–11:00 op son",
    contact: "Christo · 082 …",
  });

  async function issue() {
    try {
      const p = await passes.issue(name, chosen, hours, "Christo");
      brief = houseSitterBrief(p, facts());
      toast.show(`Pass for ${p.name} — expires ${when(p.expiresAt)}`);
      name = "";
      chosen = defaultScopes();
    } catch (e) {
      toast.show(e instanceof Error ? e.message : String(e));
    }
  }

  function showBrief(p: Pass) {
    brief = houseSitterBrief(p, facts());
  }
</script>

<section class="grp">
  <h3 class="kicker">Active passes</h3>
  {#if !passes.loaded}
    <p class="lead">Loading…</p>
  {:else if passes.active.length === 0}
    <p class="lead">No passes are active. Nobody outside the family has access.</p>
  {:else}
    {#each passes.active as p (p.id)}
      <SettingRow
        label={p.name}
        explain={`${p.scopes.length} of ${SCOPES.length} capabilities · expires ${when(p.expiresAt)}`}
        value="Revoke"
        warn
        onclick={() => { passes.revoke(p.id); toast.show("Revoked — takes effect on the next frame"); }}
      />
      <div class="scoperow">
        {#each p.scopes as s (s)}<span class="tag">{s}</span>{/each}
        <button class="briefb" onclick={() => showBrief(p)}>House-sitter brief</button>
      </div>
    {/each}
  {/if}
</section>

<section class="grp">
  <h3 class="kicker">Issue a pass</h3>
  <p class="lead">
    Scoped to what the holder may DO, not to which screens they see — a role that
    only hides views is tidiness, not security. Every scope is enforced in
    <code>firestore.rules</code> and by the HA token's own permissions.
  </p>

  <div class="form">
    <input class="in" placeholder="Who is this for?" bind:value={name} />
    <label class="dl">
      Expires in
      <select class="sel" bind:value={hours}>
        <option value={12}>12 hours</option>
        <option value={48}>2 days</option>
        <option value={168}>a week</option>
        <option value={336}>two weeks</option>
      </select>
    </label>
  </div>
  <p class="lead">
    There is no "never". The sweep closes it, so nobody has to remember.
  </p>

  <div class="chips">
    {#each SCOPES as s (s.id)}
      <button
        class="chip"
        class:on={chosen.includes(s.id)}
        class:sensitive={s.sensitive && chosen.includes(s.id)}
        onclick={() => toggle(s.id)}
        title={s.grants}
      >
        {s.id}
        {#if s.sensitive}<span class="sens" aria-label="sensitive">•</span>{/if}
      </button>
    {/each}
  </div>
  <p class="lead">
    A dot marks a capability that is never on by default. Recorded camera footage
    of a family is not a house-sitting capability — grant it deliberately or not
    at all.
  </p>

  <button class="go" onclick={issue} disabled={!name.trim() || chosen.length === 0}>
    Issue · {chosen.length} capabilities
  </button>
</section>

<section class="grp">
  <h3 class="kicker">Never grantable</h3>
  <p class="lead">
    Not "off by default" — absent from the vocabulary, so there is no code path
    that could grant one by mistake.
  </p>
  {#each NEVER_GRANTABLE as x (x)}
    <SettingRow label={x} explain="Cannot be granted to a pass at any level" value="Absent" lock />
  {/each}
</section>

{#if passes.expired.length}
  <section class="grp">
    <h3 class="kicker">Expired and revoked</h3>
    {#each passes.expired as p (p.id)}
      <SettingRow
        label={p.name}
        explain={p.revokedAt ? `revoked ${when(p.revokedAt)}` : `expired ${when(p.expiresAt)}`}
        value="Remove"
        onclick={() => passes.purge(p.id)}
      />
    {/each}
  </section>
{/if}

{#if brief}
  <section class="grp">
    <h3 class="kicker">House-sitter brief</h3>
    <p class="lead">
      Generated from the granted scopes — it documents only what the pass can
      actually do. Copy it into a message.
    </p>
    <pre class="brief">{brief}</pre>
    <button class="copyb" onclick={() => { navigator.clipboard?.writeText(brief ?? ""); toast.show("Copied"); }}>Copy</button>
  </section>
{/if}

<style>
  .grp { margin-bottom: 22px; }
  .lead { font-size: 12px; color: var(--mut); line-height: 1.55; margin: 6px 0 8px; text-wrap: pretty; }
  .lead code { font-family: ui-monospace, monospace; font-size: 11px; color: var(--tx2); }
  .form { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; margin-top: 10px; }
  .in {
    flex: 1;
    min-width: 200px;
    padding: 11px 13px;
    border-radius: var(--r-control);
    background: var(--s2);
    border: 1px solid var(--line);
    color: var(--tx);
    font-size: 13px;
  }
  .dl { display: inline-flex; align-items: center; gap: 8px; font-size: 12px; color: var(--mut); }
  .sel {
    padding: 9px 11px;
    border-radius: var(--r-control);
    background: var(--s2);
    border: 1px solid var(--line);
    color: var(--tx);
    font-size: 12.5px;
  }
  .chips, .scoperow { display: flex; flex-wrap: wrap; gap: 6px; margin: 10px 0; align-items: center; }
  .chip, .tag {
    padding: 5px 10px;
    border-radius: var(--r-pill);
    background: var(--fill);
    color: var(--mut);
    font-size: 11.5px;
    font-weight: 700;
    font-family: ui-monospace, monospace;
  }
  .chip.on { background: var(--fill-strong); color: var(--tx); }
  /* Amber hairline, not fill: granted-and-sensitive is worth noticing, not alarming. */
  .chip.sensitive { box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--warn) 45%, transparent); }
  .sens { color: var(--warn); margin-left: 4px; }
  .tag { color: var(--tx2); }
  .briefb, .copyb {
    padding: 6px 12px;
    border-radius: var(--r-pill);
    background: var(--fill);
    color: var(--tx2);
    font-size: 11.5px;
    font-weight: 700;
  }
  .go {
    margin-top: 6px;
    padding: 11px 18px;
    border-radius: var(--r-control);
    background: var(--acc);
    color: var(--acc-ink);
    font-size: 13px;
    font-weight: 800;
    min-height: 44px;
  }
  .go:disabled { opacity: 0.45; }
  .brief {
    margin: 8px 0;
    padding: 14px 16px;
    border-radius: var(--r-surface);
    background: var(--bg);
    color: var(--tx2);
    font-size: 12px;
    line-height: 1.65;
    white-space: pre-wrap;
    overflow-x: auto;
  }
</style>
