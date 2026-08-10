<script lang="ts">
  // Household — the people half. Phase 3.2 / 5.2.
  //
  // Split from House on purpose. House is "is the pump running"; Household is
  // "did the boys do their chores and what did the month cost". Different
  // readers, different questions — mixing them buried every family screen behind
  // plumbing.
  //
  // The four stats are Design's, replacing two of mine. Water and Die maand came
  // out: Water is a hub of its own, and repeating a number here teaches people
  // that the same figure lives in two places, which is how you get two sources
  // of truth. Die maand is a GENERATED REVIEW THAT ARRIVES IN THE DIGEST — it is
  // a message, not a metric, so it keeps its own card below rather than a stat.
  //
  // Every one of the four is about a person doing something. That is the test for
  // whether something belongs on this board at all.
  import { ha } from "../lib/store.svelte";
  import { money, num as afNum, t, type Lang } from "../lib/lang";
  import HubBoard, { type Stat, type Row } from "../lib/components/HubBoard.svelte";
  import Sheet from "../lib/components/Sheet.svelte";
  import TvAudit from "../lib/components/TvAudit.svelte";
  import ChoreApproval from "../lib/components/ChoreApproval.svelte";
  import { chores, ledger, tvWeek } from "../lib/household.svelte";

  let { onnav }: { onnav: (id: string) => void } = $props();

  // Household reads in Afrikaans: Mandri and the boys are its readers.
  const L: Lang = "af";

  let sheet = $state<{ kind: string } | null>(null);
  const open = (kind: string) => (sheet = { kind });

  const pending = $derived(chores.pending);
  const pendingValue = $derived(pending.reduce((s, c) => s + c.value, 0));
  const prayersNew = $derived(ha.num("sensor.gebedslys_new") ?? null);
  const prayersAnswered = $derived(ha.num("sensor.gebedslys_answered_month") ?? null);

  const stats = $derived<Stat[]>([
    {
      key: t("Chores", L),
      value: pending.length ? `${pending.length} wag` : "Alles klaar",
      units: pending.length ? `${money(pendingValue, L)} uitstaande` : undefined,
      note: pending.length ? "keur die dag in een tik goed" : "niks wag nie",
      warn: false,
      open: () => open("chores"),
    },
    {
      key: "Sakgeld",
      value: money(ledger.total, L),
      units: "Liam + Eben",
      note: "betaaldag Vrydag",
      open: () => open("ledger"),
    },
    {
      key: t("Prayer list", L),
      value: prayersNew != null ? `${afNum(prayersNew, L)} nuut` : "—",
      units: prayersAnswered != null ? `${afNum(prayersAnswered, L)} verhoor dié maand` : undefined,
      open: () => onnav("faith"),
    },
    {
      key: "Die week",
      value: tvWeek.total != null ? `${tvWeek.total} u TV` : "—",
      units: tvWeek.delta != null ? `${tvWeek.delta >= 0 ? "+" : ""}${tvWeek.delta} u op verlede week` : undefined,
      open: () => open("tv"),
    },
  ]);

  const rows = $derived<Row[]>([
    { key: "Liam · 11", sub: "grootboek, takies, twee ligte", value: "Oop", tint: "var(--water)", open: () => onnav("kids") },
    { key: "Eben · 8", sub: "net takies — geen geld, geen strepe", value: "Oop", tint: "var(--water)", open: () => onnav("kids") },
    { key: "Gebedslys & oordenking", sub: "die gebedsbord en die daaglikse oordenking", value: "Oop", tint: "var(--acc)", open: () => onnav("faith") },
    { key: "Kos & inkopies", sub: "die menu tot in die inkopielys", value: "Oop", tint: "var(--load)", open: () => onnav("meals") },
    { key: "Fair Play", sub: "wie is verantwoordelik vir wat", value: "Oop", tint: "var(--health)", open: () => onnav("fairplay") },
    { key: "Herinneringe", sub: "oor die luidsprekers, op WhatsApp, of beide", value: "Oop", tint: "var(--acc)", open: () => onnav("reminders") },
  ]);
</script>

<HubBoard
  hub="household"
  sub="die mense-helfte — stelsels bly in House"
  {stats}
  listTitle="Wie en wat"
  {rows}
  noteTitle="Hoekom dit geskei is"
  note="House is 'loop die pomp'. Household is 'het die seuns hul takies gedoen en wat het die maand gekos'. Verskillende lesers, verskillende vrae — saam begrawe dit elke gesinskerm agter pype."
  {onnav}
/>

<!-- Die maand keeps its own card, below the stats: it is a generated review that
     ARRIVES in the 21:00 digest. It is a message, not a metric. -->
<section class="review">
  <p class="kicker">Julie · die maand</p>
  <p class="rbody">
    {money(ha.num("sensor.energy_cost_this_month"), L, 0)} krag ·
    {afNum(ha.num("sensor.water_used_this_month") ?? ha.num("sensor.water_used_today"), L)} ℓ water ·
    {afNum(ledger.approvedThisMonth, L)} takies
  </p>
  <p class="rnote">Kom elke maand in die 21:00 opsomming. Dit is nie 'n plek om te gaan kyk nie.</p>
</section>

<TvAudit week={tvWeek} lang={L} onopen={() => open("tv")} />

<Sheet
  open={!!sheet}
  title={sheet?.kind === "chores" ? "Takies" : sheet?.kind === "ledger" ? "Sakgeld" : "Op die TV"}
  subtitle={sheet?.kind === "chores" ? "wag vir goedkeuring" : sheet?.kind === "ledger" ? "Liam en Eben" : "hierdie week"}
  onclose={() => (sheet = null)}
>
  {#if sheet?.kind === "chores"}
    <ChoreApproval lang={L} />
  {:else if sheet?.kind === "ledger"}
    <div class="rows">
      {#each ledger.people as p (p.id)}
        <div class="r"><span>{p.name}</span><span>{money(p.balance, L)}</span></div>
      {/each}
      <div class="r tot"><span>Altesaam</span><span>{money(ledger.total, L)}</span></div>
    </div>
    <p class="rnote">
      Die balans skuif sodra 'n takie goedgekeur is, nie op Vrydag nie. Geld wat
      eers Vrydag verskyn, is nie 'n gevolg van vandag se werk nie.
    </p>
  {:else if sheet?.kind === "tv"}
    <div class="rows">
      {#each tvWeek.people as p (p.name)}
        <div class="r"><span>{p.name}</span><span>{p.hours} u · {p.titles.join(", ")}</span></div>
      {/each}
    </div>
    <p class="rnote">
      Hierdie week teenoor verlede week. Geen limiete, geen voorstelle — die
      oomblik dit 'n limiet voorstel, word dit iets om oor te stry.
    </p>
  {/if}
</Sheet>

<style>
  .review {
    background: var(--s1);
    border-radius: var(--r-surface);
    padding: 15px 16px;
    margin-top: 14px;
  }
  .rbody { font-size: 15px; font-weight: 700; color: var(--tx); margin: 8px 0 0; text-wrap: pretty; }
  .rnote { font-size: 11.5px; color: var(--mut); line-height: 1.5; margin: 9px 0 0; text-wrap: pretty; }
  .rows { display: grid; gap: 2px; }
  .r {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 0;
    border-bottom: 1px solid var(--line);
    font-size: 13px;
    color: var(--tx);
  }
  .r:last-child { border-bottom: 0; }
  .r span:first-child { color: var(--mut); }
  .r.tot span { color: var(--tx); font-weight: 800; }
</style>
