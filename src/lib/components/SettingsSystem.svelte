<script lang="ts">
  // Settings › System › Maintenance windows. PLATFORM-CONCEPTS §3.
  //
  // THE RULE WITH TEETH: a suppression without an end time is not allowed.
  //
  // That is not a style preference. A bypassed alarm zone with no expiry IS an
  // indefinite suppression, and this house has one right now — the garage beam.
  // Nobody ever remembers to undo those, which is why the expiry is required at
  // the point of creation rather than being a field you can leave blank.
  //
  // While a window is open, every alarm, digest line and staleness badge for
  // that target goes quiet — and the suppression is VISIBLE with its end time,
  // because a silence you cannot see is indistinguishable from a system that
  // stopped working.
  import { alarms } from "../alarms.svelte";
  import { toast } from "../toast.svelte";
  import SettingRow from "./SettingRow.svelte";
  import { onMount } from "svelte";

  let target = $state("");
  let reason = $state("");
  let days = $state(3);

  onMount(() => { alarms.load(); });

  const when = (ms: number) =>
    new Date(ms).toLocaleString("en-ZA", { weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false });

  async function open() {
    try {
      await alarms.openWindow({
        target: target.trim(),
        reason: reason.trim(),
        endsAt: Date.now() + days * 86_400_000,
        createdBy: "Christo",
      });
      toast.show(`Quiet until ${when(Date.now() + days * 86_400_000)}`);
      target = ""; reason = "";
    } catch (e) {
      toast.show(e instanceof Error ? e.message : String(e));
    }
  }
</script>

<section class="grp">
  <h3 class="kicker">Maintenance windows</h3>
  <p class="lead">
    Suppresses every alarm, digest line and staleness badge for one target. The
    end time is required — there is no indefinite. A bypassed zone with no expiry
    is the same thing, and nobody remembers to undo those.
  </p>

  {#if alarms.windows.length === 0}
    <p class="lead">Nothing is suppressed. Everything that can speak up will.</p>
  {:else}
    {#each alarms.windows as w (w.id)}
      <SettingRow
        label={w.target}
        explain={`${w.reason} · quiet until ${when(w.endsAt)}`}
        value="End now"
        onclick={() => { alarms.closeWindow(w.id); toast.show("Suppression lifted"); }}
      />
    {/each}
  {/if}

  <div class="form">
    <input class="in" placeholder="Target — an entity id, a room, or a subsystem" bind:value={target} />
    <input class="in" placeholder="Reason — why is it quiet?" bind:value={reason} />
    <div class="row2">
      <label class="dl">
        Ends in
        <select class="sel" bind:value={days}>
          <option value={1}>1 day</option>
          <option value={3}>3 days</option>
          <option value={7}>a week</option>
          <option value={14}>two weeks</option>
        </select>
      </label>
      <button class="go" onclick={open} disabled={!target.trim() || !reason.trim()}>Go quiet</button>
    </div>
  </div>
</section>

<section class="grp">
  <h3 class="kicker">Acknowledged, not forgotten</h3>
  <p class="lead">
    Saying "I know" to an attention item takes it off the badge and leaves it on
    the record, with who and when. That is the difference between a list you can
    answer and one you learn to scroll past — some things take a fortnight to fix,
    and the badge should not shout for the whole fortnight.
  </p>
  {#if alarms.open.filter((a) => a.ackAt != null).length === 0}
    <p class="lead">Nothing acknowledged.</p>
  {:else}
    {#each alarms.open.filter((a) => a.ackAt != null) as a (a.key)}
      <SettingRow
        label={a.title}
        explain={`acknowledged by ${a.ackBy} · ${when(a.ackAt!)}`}
        value="Reopen"
        onclick={() => { a.ackAt = null; a.ackBy = null; toast.show("Back on the badge"); }}
      />
    {/each}
  {/if}
</section>

<style>
  .grp { margin-bottom: 22px; }
  .lead { font-size: 12px; color: var(--mut); line-height: 1.55; margin: 6px 0 8px; text-wrap: pretty; }
  .form { display: grid; gap: 8px; margin-top: 12px; }
  .in {
    padding: 11px 13px;
    border-radius: var(--r-control);
    background: var(--s2);
    border: 1px solid var(--line);
    color: var(--tx);
    font-size: 13px;
  }
  .row2 { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .dl { display: inline-flex; align-items: center; gap: 8px; font-size: 12px; color: var(--mut); }
  .sel {
    padding: 8px 10px;
    border-radius: var(--r-control);
    background: var(--s2);
    border: 1px solid var(--line);
    color: var(--tx);
    font-size: 12.5px;
  }
  .go {
    margin-left: auto;
    padding: 10px 16px;
    border-radius: var(--r-control);
    background: var(--acc);
    color: var(--acc-ink);
    font-size: 12.5px;
    font-weight: 800;
    min-height: 40px;
  }
  .go:disabled { opacity: 0.45; }
</style>
