<script lang="ts">
  // Household — Phase 3.2 / 5.2.
  //
  // Split from House on purpose. Systems and family answer different questions
  // and have different readers: House is "is the pump running", Household is
  // "did Liam do his chores and what did the month cost us". Mixing them meant
  // every family screen sat behind a wall of plumbing.
  //
  // The month in review ARRIVES in the digest; it is not a destination. It is
  // here because it has to live somewhere you can go back to, not because
  // anyone will come looking for it.
  import { ha } from "../lib/store.svelte";
  import HubBoard, { type Stat, type Row } from "../lib/components/HubBoard.svelte";
  import Sheet from "../lib/components/Sheet.svelte";

  let { onnav }: { onnav: (id: string) => void } = $props();

  // af-ZA everywhere money appears: R48,50 and 4 623, not R48.50 and 4,623.
  const afMoney = (v: number | null | undefined, dp = 2) =>
    v == null ? "—" : `R${new Intl.NumberFormat("af-ZA", { minimumFractionDigits: dp, maximumFractionDigits: dp }).format(v)}`;
  const afNum = (v: number | null | undefined, dp = 0) =>
    v == null ? "—" : new Intl.NumberFormat("af-ZA", { minimumFractionDigits: dp, maximumFractionDigits: dp }).format(v);

  let sheet = $state<{ title: string; sub: string; kind: string } | null>(null);
  const open = (title: string, sub: string, kind: string) => (sheet = { title, sub, kind });

  const monthCost = $derived(ha.num("sensor.energy_cost_this_month"));
  const monthKwh = $derived(ha.num("sensor.victron_grid_import_energy"));
  const waterMonth = $derived(ha.num("sensor.water_used_this_month") ?? ha.num("sensor.water_used_today"));

  // Bin day the night before, not on the morning: a reminder that arrives after
  // the truck is a notification about a thing you can no longer do.
  const binDay = $derived(ha.state("sensor.bin_collection_day") ?? ha.state("sensor.next_bin_day"));

  const stats = $derived<Stat[]>([
    {
      key: "Die maand",
      value: afMoney(monthCost, 0),
      units: monthKwh != null ? `${afNum(monthKwh)} kWh` : undefined,
      note: "krag tot vandag toe",
      open: () => open("Die maand", "krag, water en takies", "month"),
    },
    {
      key: "Water",
      value: waterMonth != null ? `${afNum(waterMonth)} ℓ` : "—",
      note: "hierdie maand",
      open: () => open("Water", "verbruik en die boorgat", "water"),
    },
    {
      key: "Takies",
      value: "—",
      note: "wag vir goedkeuring",
      open: () => open("Takies", "wat klaar is en wat wag", "chores"),
    },
    {
      key: "Bin day",
      value: binDay ?? "—",
      note: binDay ? "reminder goes the night before" : "no bin sensor",
      warn: false,
    },
  ]);

  const rows = $derived<Row[]>([
    { key: "Liam · 11", sub: "ledger, chores, two lights", value: "Open", tint: "var(--water)", open: () => onnav("kids") },
    { key: "Eben · 8", sub: "chores only — no money, no streaks", value: "Open", tint: "var(--water)", open: () => onnav("kids") },
    { key: "Gebedslys & oordenking", sub: "prayer board and the daily devotion", value: "Open", tint: "var(--acc)", open: () => onnav("faith") },
    { key: "Kos & inkopies", sub: "meal plan into the shopping list", value: "Open", tint: "var(--load)", open: () => onnav("meals") },
    { key: "Fair Play", sub: "who owns which task", value: "Open", tint: "var(--health)", open: () => onnav("fairplay") },
    { key: "Herinneringe", sub: "announce, WhatsApp, or both", value: "Open", tint: "var(--acc)", open: () => onnav("reminders") },
    { key: "Trello", sub: "the shared boards", value: "Open", tint: "var(--acc)", open: () => onnav("trello") },
  ]);
</script>

<HubBoard
  hub="household"
  sub="the people half — systems live in House"
  {stats}
  listTitle="Wie en wat"
  {rows}
  noteTitle="Why it is split"
  note="House is 'is the pump running'. Household is 'did the boys do their chores and what did the month cost'. They have different readers, so mixing them buried every family screen behind plumbing."
  {onnav}
/>

<Sheet
  open={!!sheet}
  title={sheet?.title ?? ""}
  subtitle={sheet?.sub ?? ""}
  onclose={() => (sheet = null)}
>
  {#if sheet?.kind === "month"}
    <div class="rows">
      <div class="r"><span>Krag</span><span>{afMoney(monthCost, 0)}</span></div>
      <div class="r"><span>Eenhede</span><span>{monthKwh != null ? `${afNum(monthKwh)} kWh` : "—"}</span></div>
      <div class="r"><span>Water</span><span>{waterMonth != null ? `${afNum(waterMonth)} ℓ` : "—"}</span></div>
    </div>
    <p class="note">
      Hierdie opsomming kom elke maand in die 21:00 opsomming. Dit is nie 'n plek
      om te gaan kyk nie — dit kom na jou toe.
    </p>
  {:else if sheet?.kind === "chores"}
    <p class="note">
      Goedkeuring werk in drie vlakke: foto-bewys, dan 'n timer wat self goedkeur
      met die aftelling wat die kind sien, dan self-sertifisering na vyf
      goedkeurings op 'n streep. Die vertroue-meter wys waar hulle is.
    </p>
    <p class="note">Keur die hele dag in een tik goed uit die 21:00 opsomming.</p>
  {:else if sheet?.kind === "water"}
    <div class="rows">
      <div class="r"><span>Vandag</span><span>{afNum(ha.num("sensor.water_used_today"))} ℓ</span></div>
      <div class="r"><span>Boorgat vandag</span><span>{afNum(ha.num("sensor.borehole_pump_water_pumped_today"))} ℓ</span></div>
    </div>
  {/if}
</Sheet>

<style>
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
  .r span:first-child { color: var(--mut); }
  .note { font-size: 12.5px; color: var(--tx2); line-height: 1.55; margin: 12px 0 0; text-wrap: pretty; }
</style>
