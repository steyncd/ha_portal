<script lang="ts">
  import { ha } from "../lib/store.svelte";
  import { prefs, PALETTES, type PaletteId } from "../lib/prefs.svelte";
  import { NAV } from "../lib/nav";
  import { toast } from "../lib/toast.svelte";
  import { HASS_URL } from "../lib/config";
  import { authStore, BOOTSTRAP_OWNERS } from "../lib/auth.svelte";
  import { addMember, removeMember, promote, demote, addGuest, setGuestViews } from "../lib/access";
  import { subscribeAccessLog, type AccessEvent } from "../lib/accessLog";
  import { NAV as NAV_ALL } from "../lib/nav";
  import { enablePush, pushGranted } from "../lib/push";
  import { parseDocument, type ParseKind } from "../lib/documents";
  import { watchParcels, addParcel, removeParcel, refreshParcels, type Parcel } from "../lib/parcels";
  import { loadHaConnection, saveHaConnection, clearHaConnection } from "../lib/haConfig";
  import Toggle from "../lib/components/Toggle.svelte";
  import { onMount } from "svelte";

  // ---- Home Assistant connection (direct vs built-in Nabu Casa) ----
  let haUrl = $state("");
  let haToken = $state("");
  let haConfigured = $state(false);
  let haBusy = $state(false);
  onMount(async () => {
    const c = await loadHaConnection();
    if (c) { haUrl = c.url; haConfigured = true; }
  });
  async function saveHa() {
    const url = haUrl.trim().replace(/\/+$/, "");
    if (!/^https:\/\//.test(url)) { toast.show("URL must start with https://"); return; }
    if (!haToken.trim()) { toast.show("Paste a long-lived access token"); return; }
    haBusy = true;
    try {
      await saveHaConnection({ url, token: haToken.trim() });
      toast.show("Saved — reconnecting…");
      setTimeout(() => location.reload(), 900);
    } catch (e) {
      toast.show(e instanceof Error ? e.message : String(e));
      haBusy = false;
    }
  }
  async function clearHa() {
    haBusy = true;
    try {
      await clearHaConnection();
      haConfigured = false; haUrl = ""; haToken = "";
      toast.show("Reverted to built-in connection — reloading…");
      setTimeout(() => location.reload(), 900);
    } catch (e) {
      toast.show(e instanceof Error ? e.message : String(e));
      haBusy = false;
    }
  }

  // ---- parcels (Ship24) ----
  let parcels = $state<Parcel[]>([]);
  let newTracking = $state("");
  let newLabel = $state("");
  onMount(() => watchParcels((p) => (parcels = p)));
  async function onAddParcel() {
    try { await addParcel(newTracking, newLabel); newTracking = ""; newLabel = ""; toast.show("Parcel added"); refreshParcels(); }
    catch (e) { toast.show(e instanceof Error ? e.message : String(e)); }
  }

  let pushOn = $state(pushGranted());

  // ---- document (receipt / statement) parsing ----
  let docKind = $state<ParseKind>("statement");
  let docBusy = $state(false);
  let docErr = $state("");
  let docResult = $state<Record<string, unknown> | null>(null);
  async function onDocFile(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return;
    docBusy = true; docErr = ""; docResult = null;
    try {
      const r = await parseDocument(f, docKind);
      if (r.ok) { docResult = r.extracted ?? {}; toast.show("Document parsed"); }
      else docErr = r.error ?? "Couldn't parse the document";
    } catch (err) { docErr = err instanceof Error ? err.message : String(err); }
    docBusy = false;
  }
  async function turnOnPush() {
    const r = await enablePush();
    toast.show(r.msg);
    if (r.ok) pushOn = true;
  }

  let { ontv }: { ontv: () => void } = $props();

  const haHost = (() => { try { return new URL(HASS_URL).host; } catch { return HASS_URL; } })();
  function signOut() { authStore.signOut(); }

  // ---- profile ----
  const me = $derived(authStore.user);
  const myName = $derived(me?.displayName ?? me?.email?.split("@")[0] ?? "Signed in");
  const myInitial = $derived((me?.displayName ?? me?.email ?? "?").charAt(0).toUpperCase());
  let editingName = $state(false);
  let nameDraft = $state("");
  function startEditName() { nameDraft = me?.displayName ?? ""; editingName = true; }
  async function saveName() {
    if (nameDraft.trim()) { await authStore.setDisplayName(nameDraft); toast.show("Name updated"); }
    editingName = false;
  }

  // ---- admin: user access management (owners only) ----
  const lc = (s: string) => s.trim().toLowerCase();
  const roster = $derived.by(() => {
    const owners = new Set(authStore.owners.map(lc));
    const all = [...new Set([...authStore.members.map(lc), ...authStore.owners.map(lc)])].filter(Boolean);
    return all.sort().map((email) => ({ email, isOwner: owners.has(email), isBootstrap: BOOTSTRAP_OWNERS.map(lc).includes(email) }));
  });
  let newEmail = $state("");
  async function addUser() {
    const e = newEmail.trim();
    if (!e || !e.includes("@")) { toast.show("Enter a valid email"); return; }
    try { await addMember(e); toast.show(`${e} added`); newEmail = ""; }
    catch { toast.show("Couldn't add — owners only"); }
  }
  async function removeUser(email: string) {
    if (lc(email) === lc(me?.email ?? "")) { toast.show("You can't remove yourself"); return; }
    try { await removeMember(email); toast.show(`${email} removed`); } catch { toast.show("Couldn't remove"); }
  }
  async function toggleOwner(email: string, isOwner: boolean) {
    try { isOwner ? await demote(email) : await promote(email); toast.show("Role updated"); }
    catch { toast.show("Couldn't change role"); }
  }

  // ---- guests (restricted, per-person views) ----
  // Views an owner may share with a guest (everything except Overview, which is
  // always shown, and Settings, which guests never get).
  const GRANTABLE = NAV_ALL.filter((v) => !["overview", "settings"].includes(v.id));
  const DEFAULT_GUEST_VIEWS = ["energy", "water", "lights"];
  let newGuest = $state("");
  const guestList = $derived(authStore.guests.map(lc).sort());
  const viewsFor = (email: string) => authStore.guestConfig.find((g) => lc(g.e) === lc(email))?.v ?? [];
  async function addGuestUser() {
    const e = newGuest.trim();
    if (!e || !e.includes("@")) { toast.show("Enter a valid email"); return; }
    try { await addGuest(e, DEFAULT_GUEST_VIEWS); toast.show(`${e} added as guest`); newGuest = ""; }
    catch { toast.show("Couldn't add — owners only"); }
  }
  async function toggleGuestView(email: string, viewId: string) {
    const cur = viewsFor(email);
    const next = cur.includes(viewId) ? cur.filter((v) => v !== viewId) : [...cur, viewId];
    try { await setGuestViews(email, next); } catch { toast.show("Couldn't update — owners only"); }
  }

  // ---- access log (owners only) ----
  let accessEvents = $state<AccessEvent[]>([]);
  onMount(() => {
    if (!authStore.isOwner) return;
    return subscribeAccessLog((e) => (accessEvents = e));
  });
  const viewName = (id: string | null) => (id ? (NAV_ALL.find((n) => n.id === id)?.name ?? id) : "");
  function agoTs(ms: number) {
    if (!ms) return "";
    const m = Math.round((Date.now() - ms) / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.round(m / 60);
    return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
  }

  // ---- WhatsApp inbound (allow-list + enable), stored in HA ----
  const waConfigured = $derived(ha.exists("input_text.wa_allowed_senders"));
  const waEnabled = $derived(ha.isOn("input_boolean.wa_inbound_enabled"));
  const waSenders = $derived(
    (ha.state("input_text.wa_allowed_senders") ?? "").split(",").map((s) => s.trim()).filter(Boolean),
  );
  let newSender = $state("");
  function addSender() {
    const n = newSender.replace(/\D/g, "");
    if (!n) { toast.show("Enter a number (digits only)"); return; }
    ha.setText("input_text.wa_allowed_senders", [...new Set([...waSenders, n])].join(","));
    toast.show(`${n} added`); newSender = "";
  }
  function removeSender(n: string) {
    ha.setText("input_text.wa_allowed_senders", waSenders.filter((s) => s !== n).join(","));
    toast.show("Removed");
  }

  // Health goals (input_number helpers). min/max/step read from the entity, with fallbacks.
  const healthGoals = [
    { id: "input_number.oura_steps_goal", icon: "👟", name: "Daily steps goal", min: 1000, max: 20000, step: 500, unit: "" },
    { id: "input_number.oura_readiness_low_threshold", icon: "🔋", name: "Low-readiness alert below", min: 50, max: 90, step: 1, unit: "" },
    { id: "input_number.oura_temp_deviation_threshold", icon: "🌡️", name: "Illness temp deviation", min: 0.1, max: 1.5, step: 0.1, unit: "°C" },
  ].filter((g) => ha.exists(g.id));
  function goalBound(id: string, attr: string, fallback: number) {
    const v = ha.attr(id, attr); return typeof v === "number" ? v : fallback;
  }

  function setPalette(id: PaletteId) { prefs.setPalette(id); }
  function setDensity(d: "comfortable" | "wall") { prefs.density = d; prefs.apply(); prefs.save(); }
  function toggleMotion() { prefs.motion = !prefs.motion; prefs.apply(); prefs.save(); }
  function toggleGuest() { prefs.guest = !prefs.guest; prefs.save(); }
  function setDefaultView(id: string) { prefs.defaultView = id; prefs.save(); }
  function toggleView(id: string) { prefs.viewsOn = { ...prefs.viewsOn, [id]: !prefs.viewsOn[id] }; prefs.save(); }

  const people = [
    { id: "person.christo_steyn", name: "Christo", role: "ADMIN", initial: "C", color: "var(--acc)" },
    { id: "person.mandri_steyn", name: "Mandri", role: "ADULT", initial: "M", color: "#f472b6" },
    { id: "person.hello_liam_en_eben", name: "Liam & Eben", role: "KIDS", initial: "L", color: "var(--water)" },
  ];

  const autoArm = [
    { id: "input_boolean.alarm_auto_arm_away", name: "Auto-arm · Away", sub: "when everyone leaves" },
    { id: "input_boolean.alarm_auto_arm_stay", name: "Auto-arm · Stay", sub: "at night" },
    { id: "input_boolean.alarm_auto_arm_beams", name: "Auto-arm · Beams", sub: "perimeter beams" },
    { id: "input_boolean.alarm_auto_disarm", name: "Auto-disarm", sub: "on arrival / morning" },
    { id: "input_boolean.alarm_auto_disarm_beams", name: "Auto-disarm · Beams", sub: "morning" },
  ];
  const schedule = [
    { id: "input_datetime.alarm_auto_arm_away_time", name: "Arm away" },
    { id: "input_datetime.alarm_auto_arm_stay_time", name: "Arm stay" },
    { id: "input_datetime.alarm_auto_arm_time_beams", name: "Arm beams" },
    { id: "input_datetime.alarm_auto_disarm_time", name: "Disarm" },
    { id: "input_datetime.alarm_auto_disarm_time_beams", name: "Disarm beams" },
  ];
  const notifs = [
    { id: "input_boolean.frigate_person_detection_enabled", icon: "🚶", name: "Person detection" },
    { id: "input_boolean.frigate_vehicle_detection_enabled", icon: "🚗", name: "Vehicle detection" },
    { id: "input_boolean.door_open_alerts_enabled", icon: "🚪", name: "Door-open alerts" },
    { id: "input_boolean.printer_ink_notifications", icon: "🖨️", name: "Printer ink low" },
    { id: "input_boolean.irrigation_intelligence_enabled", icon: "🌿", name: "Smart irrigation" },
  ];
  const automations = [
    { id: "input_boolean.borehole_night_guard_enabled", icon: "🕳️", name: "Borehole night guard" },
    { id: "input_boolean.frigate_watchdog_enabled", icon: "📷", name: "Frigate self-heal" },
    { id: "input_boolean.light_watchdog_enabled", icon: "💡", name: "Light watchdog" },
    { id: "input_boolean.appliance_finish_alerts_enabled", icon: "🔔", name: "Appliance-done alerts" },
    { id: "input_boolean.window_advisor_enabled", icon: "🪟", name: "Window advisor" },
    { id: "input_boolean.fridge_open_alert_enabled", icon: "🧊", name: "Fridge-open alert" },
    { id: "input_boolean.desk_comfort_enabled", icon: "🪑", name: "Desk comfort" },
    { id: "input_boolean.evening_lights_enabled", icon: "🌆", name: "Evening lights" },
    { id: "input_boolean.night_kitchen_light_enabled", icon: "🌙", name: "Night kitchen light" },
    { id: "input_boolean.holiday_mode", icon: "🏖️", name: "Holiday mode" },
  ];
  const bypassOpts = $derived((ha.attr("input_select.zone_bypass_selector", "options") as string[]) ?? []);
  const bypassVal = $derived(ha.state("input_select.zone_bypass_selector") ?? "");

  const msgPresets = ["Dinner's ready! 🍽️", "Time to leave 🚗", "Goodnight all 🌙", "I'm home 🏠", "Load-shedding soon ⚡", "Movie starting 🎬"];
  let msgText = $state("");
  async function send(text: string) {
    const m = text.trim();
    if (!m) return;
    try { await ha.announce(m); toast.show(`Announced: "${m}"`); msgText = ""; }
    catch { toast.show("Couldn't announce — check the HA connection"); }
  }

  const configurableViews = NAV.filter((v) => !["overview", "security", "settings"].includes(v.id));
  function timeVal(id: string) { return (ha.state(id) ?? "").slice(0, 5); }

  // ---- section tabs ----
  const TABS = [
    { id: "account", name: "Account" },
    { id: "appearance", name: "Appearance" },
    { id: "alarm", name: "Alarm" },
    { id: "notify", name: "Notify" },
    { id: "health", name: "Health" },
    { id: "views", name: "Views" },
    { id: "system", name: "System" },
  ];
  let tab = $state(prefs.settingsTab);
  function setTab(id: string) { tab = id; prefs.settingsTab = id; prefs.save(); }
</script>

<div class="col">
  <div class="tabbar">
    {#each TABS as t}
      <button class="tb" class:active={tab === t.id} onclick={() => setTab(t.id)}>{t.name}</button>
    {/each}
  </div>

  {#if tab === "account"}
  <!-- profile -->
  <h2 class="section">Profile</h2>
  <div class="card pad acct">
    {#if me?.photoURL}
      <img class="aav img" src={me.photoURL} alt="" referrerpolicy="no-referrer" />
    {:else}
      <span class="aav">{myInitial}</span>
    {/if}
    <div class="ainfo">
      {#if editingName}
        <div class="editrow">
          <input bind:value={nameDraft} placeholder="Display name" onkeydown={(e) => e.key === "Enter" && saveName()} />
          <button class="minibtn" onclick={saveName}>Save</button>
          <button class="minibtn ghost" onclick={() => (editingName = false)}>✕</button>
        </div>
      {:else}
        <div class="anm2">
          {myName}
          <span class="rolechip" class:owner={authStore.isOwner}>{authStore.isOwner ? "Owner" : "Member"}</span>
          <button class="editname" onclick={startEditName} title="Edit name">✎</button>
        </div>
      {/if}
      <div class="asub2">{me?.email ?? ""} · HA {haHost}</div>
    </div>
    <button class="signout" onclick={signOut}>Sign out</button>
  </div>
  {/if}

  <!-- admin: user access (owners only) -->
  {#if tab === "system" && authStore.isOwner}
    <h2 class="section">Admin · Portal access</h2>
    <div class="card pad">
      <div class="lb" style="margin-bottom:12px">Who can sign in ({roster.length})</div>
      {#each roster as u}
        <div class="urow">
          <span class="uav2">{u.email.charAt(0).toUpperCase()}</span>
          <div class="uinfo">
            <div class="uem">{u.email}{#if lc(u.email) === lc(me?.email ?? "")}<span class="you"> · you</span>{/if}</div>
            <div class="urole">{u.isOwner ? "Owner" : "Member"}{#if u.isBootstrap} · built-in{/if}</div>
          </div>
          <button class="rolebtn" onclick={() => toggleOwner(u.email, u.isOwner)} disabled={u.isBootstrap} title={u.isBootstrap ? "Built-in owner" : ""}>
            {u.isOwner ? "Make member" : "Make owner"}
          </button>
          <button class="rmbtn" onclick={() => removeUser(u.email)} disabled={u.isBootstrap || lc(u.email) === lc(me?.email ?? "")} title="Remove">✕</button>
        </div>
      {/each}
      <div class="composer" style="margin-top:14px">
        <input bind:value={newEmail} placeholder="Add person by Google email…" onkeydown={(e) => e.key === "Enter" && addUser()} />
        <button class="send" onclick={addUser}>Add</button>
      </div>
      <div class="note">Owners can manage access and branding. Members get full use of the portal. Built-in owners are set in code and can't be removed here.</div>
    </div>

    <!-- guests: restricted, per-person views -->
    <div class="card pad">
      <div class="lb" style="margin-bottom:6px">Guest access ({guestList.length})</div>
      <div class="note" style="margin-bottom:12px">Guests are locked to a restricted view — only the pages you tick below (plus Overview). They can't reach Settings, and can't switch it off.</div>
      {#each guestList as g}
        {@const gv = viewsFor(g)}
        <div class="guestrow">
          <div class="grtop">
            <span class="uav2">{g.charAt(0).toUpperCase()}</span>
            <div class="uem" style="flex:1">{g}</div>
            <button class="rmbtn" onclick={() => removeUser(g)} title="Remove guest">✕</button>
          </div>
          <div class="gviews">
            {#each GRANTABLE as v}
              <button class="vchip" class:on={gv.includes(v.id)} onclick={() => toggleGuestView(g, v.id)}>{v.name}</button>
            {/each}
          </div>
        </div>
      {/each}
      <div class="composer" style="margin-top:14px">
        <input bind:value={newGuest} placeholder="Add guest by Google email…" onkeydown={(e) => e.key === "Enter" && addGuestUser()} />
        <button class="send" onclick={addGuestUser}>Add guest</button>
      </div>
      <div class="note" style="margin-top:8px">Note: a guest still connects through the household's Home Assistant, so treat guest access as "trusted visitor", not a security sandbox.</div>
    </div>

    <!-- access log -->
    <div class="card pad">
      <div class="rh"><span class="lb">Access log</span><span class="sub">recent sign-ins &amp; views</span></div>
      {#if accessEvents.length}
        <div class="loglist">
          {#each accessEvents as e}
            <div class="logrow">
              <span class="lgwho">{e.name || e.email}</span>
              <span class="lgev">{e.event === "signin" ? "signed in" : `opened ${viewName(e.view)}`}</span>
              <span class="lgrole" class:guest={e.role === "guest"}>{e.role}</span>
              <span class="lgt">{agoTs(e.ts)}</span>
            </div>
          {/each}
        </div>
      {:else}<div class="note">No access events logged yet.</div>{/if}
    </div>
  {/if}

  <!-- WhatsApp inbound (owners only) -->
  {#if tab === "notify" && authStore.isOwner && waConfigured}
    <h2 class="section">WhatsApp · HQ chat</h2>
    <div class="card pad">
      <div class="arow"><span class="ni">💬</span><div class="al"><div class="an">Inbound commands &amp; chat</div><div class="as">Text your HQ number to log data, ask questions, or control the house</div></div><Toggle on={waEnabled} onchange={() => ha.toggleBoolean("input_boolean.wa_inbound_enabled")} /></div>
      <div class="lb" style="margin:16px 0 10px">Allowed senders</div>
      {#if waSenders.length === 0}
        <div class="wawarn">⚠️ Empty — anyone with the webhook link can message HQ. Add your number to lock it to you.</div>
      {:else}
        <div class="wachips">
          {#each waSenders as n}
            <span class="wachip">{n}<button class="wax" onclick={() => removeSender(n)} aria-label="Remove {n}">✕</button></span>
          {/each}
        </div>
      {/if}
      <div class="composer" style="margin-top:12px">
        <input bind:value={newSender} placeholder="Your WhatsApp number, e.g. 27820001234" inputmode="numeric" onkeydown={(e) => e.key === "Enter" && addSender()} />
        <button class="send" onclick={addSender}>Add</button>
      </div>
      <div class="note">Numbers are matched on digits only. Send <b>help</b> from WhatsApp to see every command.</div>
    </div>
  {/if}

  {#if tab === "appearance"}
  <!-- appearance -->
  <h2 class="section">Appearance</h2>
  <div class="card pad">
    <div class="lb" style="margin-bottom:14px">Theme</div>
    <div class="palettes">
      {#each PALETTES as p}
        <button class="pal" class:active={prefs.palette === p.id} onclick={() => setPalette(p.id)}>
          <span class="palsw" style="background:{p.base}">
            <span class="paldot" style="background:{p.acc}"></span>
            <span class="paldot" style="background:{p.acc2}"></span>
          </span>
          <span class="palname">{p.name}</span>
        </button>
      {/each}
    </div>
  </div>
  <div class="two">
    <div class="card pad">
      <div class="lb" style="margin-bottom:12px">Density</div>
      <div class="seg">
        <button class:active={prefs.density === "comfortable"} onclick={() => setDensity("comfortable")}>Comfortable</button>
        <button class:active={prefs.density === "wall"} onclick={() => setDensity("wall")}>Wall / TV</button>
      </div>
      <div class="note" style="margin-top:8px">Wall mode enlarges hero metrics and hides secondary detail for across-room glance.</div>
    </div>
    <div class="card pad row"><div><div class="rn">Motion & aurora</div><div class="rs">Ambient glow + flow animations</div></div><Toggle on={prefs.motion} onchange={toggleMotion} /></div>
  </div>
  <div class="card pad row">
    <div><div class="rn">🔔 Push notifications</div><div class="rs">Alarm, low balance, load-shedding — to this device</div></div>
    {#if pushOn}<span class="rolechip owner">Enabled</span>{:else}<button class="minibtn" onclick={turnOnPush}>Enable</button>{/if}
  </div>
  <div class="two">
    <div class="card pad row">
      <div><div class="rn">👋 Guest view</div><div class="rs">Hides Security, Cameras, Traffic, location &amp; health</div></div>
      <Toggle on={prefs.guest} onchange={toggleGuest} />
    </div>
    <div class="card pad">
      <div class="lb" style="margin-bottom:10px">Default view on open</div>
      <select value={prefs.defaultView} onchange={(e) => setDefaultView((e.target as HTMLSelectElement).value)}>
        <option value="overview">Overview</option>
        {#each configurableViews as v}<option value={v.id}>{v.name}</option>{/each}
      </select>
    </div>
  </div>
  {/if}

  {#if tab === "account"}
  <!-- people -->
  <h2 class="section">Household</h2>
  <div class="card pad">
    <div class="lb" style="margin-bottom:12px">People & profiles</div>
    {#each people as p}
      {@const home = ha.state(p.id) === "home"}
      <div class="prow">
        <span class="pav" style="background:{p.color}">{p.initial}</span>
        <div class="pl"><div class="pn">{p.name}</div><div class="pst" style="color:{home ? 'var(--success)' : 'var(--muted)'}">{home ? "Home" : ha.exists(p.id) ? "Away" : "—"}</div></div>
        <span class="role">{p.role}</span>
      </div>
    {/each}
  </div>
  {/if}

  {#if tab === "alarm"}
  <!-- alarm automations + schedule -->
  <h2 class="section">Security &amp; alarm</h2>
  <div class="two">
    <div class="card pad">
      <div class="lb" style="margin-bottom:6px">Alarm automations</div>
      {#each autoArm as r}
        <div class="arow"><div class="al"><div class="an">{r.name}</div><div class="as">{r.sub}</div></div><Toggle on={ha.isOn(r.id)} onchange={() => ha.toggleBoolean(r.id)} /></div>
      {/each}
    </div>
    <div class="card pad">
      <div class="lb" style="margin-bottom:8px">Schedule</div>
      {#each schedule as r}
        <div class="srow"><span class="sn">{r.name}</span><input type="time" value={timeVal(r.id)} onchange={(e) => ha.setDatetime(r.id, (e.target as HTMLInputElement).value + ":00")} /></div>
      {/each}
    </div>
  </div>

  <!-- notifications + zone bypass -->
  <div class="two">
    <div class="card pad">
      <div class="lb" style="margin-bottom:6px">Notifications</div>
      {#each notifs as r}
        <div class="arow"><span class="ni">{r.icon}</span><span class="nn">{r.name}</span><Toggle on={ha.isOn(r.id)} onchange={() => ha.toggleBoolean(r.id)} /></div>
      {/each}
    </div>
    <div class="card pad">
      <div class="lb" style="margin-bottom:12px">Security · zone bypass</div>
      <select value={bypassVal} onchange={(e) => ha.setSelect("input_select.zone_bypass_selector", (e.target as HTMLSelectElement).value)}>
        {#each bypassOpts as o}<option value={o}>{o}</option>{/each}
        {#if bypassOpts.length === 0}<option>None available</option>{/if}
      </select>
      <div class="note">Temporarily excludes a zone from arming. Confirm on the Security screen.</div>
    </div>
  </div>

  {/if}

  {#if tab === "system"}
  <h2 class="section">Automations</h2>
  <div class="card pad">
    <div class="agrid">
      {#each automations as r}
        <div class="arow"><span class="ni">{r.icon}</span><span class="nn">{r.name}</span><Toggle on={ha.isOn(r.id)} onchange={() => ha.toggleBoolean(r.id)} /></div>
      {/each}
    </div>
  </div>
  {/if}

  {#if tab === "system" && authStore.isOwner}
  <h2 class="section">Home Assistant connection</h2>
  <div class="card pad">
    <div class="note" style="margin-bottom:12px">
      {#if haConfigured}
        Connecting <strong>directly</strong> to <code>{haUrl}</code>. This is faster than the built-in relay. If it ever becomes unreachable the portal automatically falls back to the built-in connection.
      {:else}
        Currently using the built-in connection (<code>{HASS_URL.replace('https://','')}</code>) via Nabu Casa. Enter a direct HTTPS URL + a long-lived token to connect straight to your instance for lower latency.
      {/if}
    </div>
    <label class="fld"><span>Direct URL</span>
      <input bind:value={haUrl} placeholder="https://ha.helloliam.co.za" autocomplete="off" spellcheck="false" />
    </label>
    <label class="fld"><span>Long-lived access token</span>
      <input bind:value={haToken} type="password" placeholder={haConfigured ? "•••••••• (stored — paste again to change)" : "Paste token from HA → Profile → Security"} autocomplete="off" spellcheck="false" />
    </label>
    <div class="btnrow">
      <button class="save" onclick={saveHa} disabled={haBusy}>{haBusy ? "Saving…" : haConfigured ? "Update connection" : "Connect directly"}</button>
      {#if haConfigured}<button class="ghost" onclick={clearHa} disabled={haBusy}>Revert to built-in</button>{/if}
    </div>
    <div class="note" style="margin-top:10px">Create a token in Home Assistant → your profile → <em>Security</em> → “Long-lived access tokens”. Your HA must be reachable over HTTPS and allow this portal's origin in <code>cors_allowed_origins</code>.</div>
  </div>
  {/if}

  <!-- health goals -->
  {#if tab === "health" && healthGoals.length}
    <h2 class="section">Health &amp; goals</h2>
    <div class="card pad">
      {#each healthGoals as g}
        {@const val = ha.num(g.id) ?? g.min}
        {@const min = goalBound(g.id, "min", g.min)}
        {@const max = goalBound(g.id, "max", g.max)}
        {@const step = goalBound(g.id, "step", g.step)}
        <div class="goal">
          <div class="grow"><span class="gname">{g.icon} {g.name}</span><span class="gval">{val.toLocaleString()}{g.unit}</span></div>
          <input type="range" {min} {max} {step} value={val} onchange={(e) => ha.setNumber(g.id, Number((e.target as HTMLInputElement).value))} />
        </div>
      {/each}
      <div class="note">Feeds the Oura automations (steps nudge, low-readiness morning, illness warning).</div>
    </div>
  {/if}

  {#if tab === "notify"}
  <!-- broadcast -->
  <h2 class="section">Messages</h2>
  <div class="card pad">
    <div class="lb" style="margin-bottom:14px">Broadcast & messages</div>
    <div class="presets">
      {#each msgPresets as m}<button class="preset" onclick={() => send(m)}>{m}</button>{/each}
    </div>
    <div class="composer">
      <input bind:value={msgText} placeholder="Type a custom message or announcement…" onkeydown={(e) => e.key === "Enter" && send(msgText)} />
      <button class="send" onclick={() => send(msgText)}>Send</button>
    </div>
  </div>

  {/if}

  {#if tab === "views"}
  <!-- enabled views -->
  <h2 class="section">Views</h2>
  <div class="card pad">
    <div class="lb" style="margin-bottom:12px">Enabled views · tap to toggle</div>
    <div class="views">
      {#each configurableViews as v}
        <button class="vchip" class:on={prefs.viewsOn[v.id]} onclick={() => toggleView(v.id)}><span>{v.icon}</span>{v.name}</button>
      {/each}
    </div>
  </div>

  {/if}

  {#if tab === "notify"}
  <h2 class="section">Deliveries</h2>
  <div class="card pad">
    <div class="lb" style="margin-bottom:12px">📦 Parcel tracking</div>
    {#if parcels.length === 0}<div class="sub" style="margin-bottom:10px">No parcels tracked yet — add a tracking number below (courier auto-detected).</div>{/if}
    {#each parcels as p}
      <div class="urow">
        <span class="uav2">📦</span>
        <div class="uinfo"><div class="uem">{p.label || p.trackingNumber}</div><div class="urole" style="text-transform:capitalize">{(p.status || "pending").replace(/_/g, " ")}{#if p.lastEvent} · {p.lastEvent}{/if}</div></div>
        <button class="rmbtn" onclick={() => removeParcel(p.id)} aria-label="Remove">✕</button>
      </div>
    {/each}
    <div class="composer" style="margin-top:12px">
      <input bind:value={newTracking} placeholder="Tracking number" onkeydown={(e) => e.key === "Enter" && onAddParcel()} />
      <input bind:value={newLabel} placeholder="Label" style="max-width:130px" />
      <button class="send" onclick={onAddParcel}>Add</button>
    </div>
    <button class="minibtn ghost" style="margin-top:10px" onclick={refreshParcels}>↻ Refresh statuses</button>
  </div>
  {/if}

  {#if tab === "system"}
  <h2 class="section">Documents</h2>
  <div class="card pad">
    <div class="lb" style="margin-bottom:12px">📄 Scan a receipt or statement</div>
    <div class="seg" style="max-width:280px;margin-bottom:14px">
      <button class:active={docKind === "statement"} onclick={() => (docKind = "statement")}>Statement</button>
      <button class:active={docKind === "receipt"} onclick={() => (docKind = "receipt")}>Receipt</button>
    </div>
    <input type="file" accept="image/*,application/pdf" onchange={onDocFile} disabled={docBusy} />
    {#if docBusy}<div class="note">Analysing with AI…</div>{/if}
    {#if docErr}<div class="wawarn" style="margin-top:10px">{docErr}</div>{/if}
    {#if docResult}
      <div class="docres">
        {#each Object.entries(docResult) as [k, v]}
          {#if k !== "items" && k !== "type"}<div><span>{k.replace(/_/g, " ")}</span><b>{v ?? "—"}</b></div>{/if}
        {/each}
      </div>
    {/if}
    <div class="note">Statements feed net worth (Allan Gray / Alex Forbes / PPS); receipts log spend. Data extracted by Gemini vision.</div>
  </div>
  {/if}

  <div class="card tvlink">Casting to a wall display? Open the standalone <button class="tvbtn" onclick={ontv}>TV Overview →</button></div>
</div>

<style>
  .col { display: flex; flex-direction: column; gap: 14px; }
  .section { font-size: 12px; font-weight: 800; letter-spacing: 1.4px; text-transform: uppercase; color: var(--muted-2); margin: 8px 2px -4px; }
  .section:first-child { margin-top: 0; }
  .tabbar { display: flex; gap: 5px; flex-wrap: wrap; padding: 5px; border-radius: 14px; background: var(--soft); box-shadow: inset 0 0 0 1px var(--line); }
  .tb { flex: 1 1 auto; min-width: 76px; padding: 9px 12px; border: none; border-radius: 10px; background: transparent; color: var(--muted); font-size: 13px; font-weight: 700; cursor: pointer; transition: color 0.15s, background 0.15s; }
  .tb:hover { color: var(--text); }
  .tb.active { background: var(--grad); color: #fff; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.28); }
  .agrid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 24px; }
  @media (max-width: 640px) { .agrid { grid-template-columns: 1fr; } }
  .pad { padding: 22px; }
  .acct { display: flex; align-items: center; gap: 15px; }
  .aav { width: 46px; height: 46px; flex-shrink: 0; border-radius: 50%; background: var(--grad); display: grid; place-items: center; font-size: 18px; font-weight: 800; color: #0b1017; }
  .ainfo { flex: 1; min-width: 0; }
  .anm2 { font-size: 15px; font-weight: 700; }
  .asub2 { font-size: 11.5px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .signout { padding: 10px 16px; border-radius: 11px; background: color-mix(in srgb, var(--error) 16%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--error) 34%, transparent); color: #fecdd6; font-size: 12.5px; font-weight: 700; }
  .aav.img { object-fit: cover; }
  .anm2 { display: flex; align-items: center; gap: 8px; }
  .rolechip { font-size: 9.5px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; padding: 3px 8px; border-radius: 999px; background: rgba(255,255,255,0.08); color: var(--muted); }
  .rolechip.owner { background: var(--soft); color: var(--acc); box-shadow: inset 0 0 0 1px var(--line); }
  .editname { font-size: 12px; color: var(--muted); padding: 2px 6px; border-radius: 6px; }
  .editname:hover { background: rgba(255,255,255,0.08); }
  .editrow { display: flex; gap: 8px; align-items: center; }
  .editrow input { flex: 1; background: rgba(255,255,255,0.06); border: none; border-radius: 10px; color: var(--text); font-size: 14px; padding: 8px 10px; outline: none; }
  .minibtn { padding: 8px 12px; border-radius: 9px; background: var(--grad); color: #0b1017; font-size: 12px; font-weight: 700; }
  .minibtn.ghost { background: rgba(255,255,255,0.08); color: var(--text); }
  .urow { display: flex; align-items: center; gap: 11px; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.06); }
  .urow:last-of-type { border-bottom: none; }
  .uav2 { width: 34px; height: 34px; flex-shrink: 0; border-radius: 50%; background: rgba(255,255,255,0.1); display: grid; place-items: center; font-size: 13px; font-weight: 800; }
  .uinfo { flex: 1; min-width: 0; }
  .uem { font-size: 13px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .you { color: var(--acc); font-weight: 700; }
  .urole { font-size: 11px; color: var(--muted); }
  .rolebtn { padding: 7px 11px; border-radius: 9px; background: rgba(255,255,255,0.07); color: var(--text); font-size: 11.5px; font-weight: 600; white-space: nowrap; }
  .rolebtn:disabled, .rmbtn:disabled { opacity: 0.35; cursor: not-allowed; }
  .rmbtn { width: 30px; height: 30px; flex-shrink: 0; border-radius: 8px; background: color-mix(in srgb, var(--error) 14%, transparent); color: #fecdd6; font-size: 13px; }
  .wachips { display: flex; flex-wrap: wrap; gap: 8px; }
  .wachip { display: inline-flex; align-items: center; gap: 8px; padding: 8px 10px 8px 13px; border-radius: 999px; background: var(--soft); box-shadow: inset 0 0 0 1px var(--line); font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums; }
  .wax { width: 20px; height: 20px; border-radius: 50%; background: rgba(255,255,255,0.1); color: var(--muted); font-size: 11px; }
  .wax:hover { background: color-mix(in srgb, var(--error) 22%, transparent); color: #fecdd6; }
  .wawarn { font-size: 12.5px; color: var(--warning); background: color-mix(in srgb, var(--warning) 12%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--warning) 30%, transparent); padding: 10px 12px; border-radius: 11px; line-height: 1.5; }
  .docres { margin-top: 12px; display: flex; flex-direction: column; gap: 6px; }
  .docres div { display: flex; justify-content: space-between; gap: 12px; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.06); font-size: 13px; }
  .docres span { color: var(--muted); text-transform: capitalize; }
  .docres b { font-weight: 700; }
  .goal { padding: 10px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.06); }
  .goal:last-of-type { border-bottom: none; }
  .grow { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 9px; }
  .gname { font-size: 13px; font-weight: 600; }
  .gval { font-size: 13px; font-weight: 800; color: var(--acc); }
  .goal input[type="range"] { width: 100%; accent-color: var(--acc); }
  .two { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  @media (max-width: 760px) { .two { grid-template-columns: 1fr; } }
  .palettes { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }
  .pal { display: flex; align-items: center; gap: 11px; padding: 10px 12px; border-radius: 12px; text-align: left; background: rgba(255, 255, 255, 0.028); box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08); transition: box-shadow var(--dur) var(--ease); }
  .pal:hover { box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.18); }
  .pal.active { box-shadow: inset 0 0 0 1.5px var(--acc); }
  .palsw { position: relative; width: 34px; height: 34px; border-radius: 9px; flex-shrink: 0; overflow: hidden; box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.12); }
  .paldot { position: absolute; width: 15px; height: 15px; border-radius: 50%; top: 50%; transform: translateY(-50%); }
  .paldot:first-of-type { left: 4px; }
  .paldot:last-of-type { right: 4px; }
  .palname { font-size: 12.5px; font-weight: 600; color: var(--text-2); }
  .row { display: flex; align-items: center; justify-content: space-between; }
  .rn { font-size: 13px; font-weight: 600; }
  .rs { font-size: 11px; color: var(--muted); }
  .seg { display: flex; gap: 6px; background: rgba(255, 255, 255, 0.05); border-radius: 12px; padding: 4px; }
  .seg button { flex: 1; padding: 10px; border-radius: 9px; font-size: 12.5px; font-weight: 600; color: var(--text); }
  .seg button.active { background: var(--grad); color: #0b1017; }
  .prow { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.06); }
  .pav { width: 38px; height: 38px; border-radius: 50%; display: grid; place-items: center; font-size: 14px; font-weight: 800; color: #0b1017; }
  .pl { flex: 1; }
  .pn { font-size: 13.5px; font-weight: 600; }
  .pst { font-size: 11px; }
  .role { font-size: 10px; font-weight: 800; letter-spacing: 0.05em; padding: 4px 9px; border-radius: 999px; background: rgba(255, 255, 255, 0.06); color: var(--muted); }
  .arow { display: flex; align-items: center; gap: 12px; padding: 11px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.06); }
  .al { flex: 1; }
  .an { font-size: 13px; font-weight: 600; }
  .as { font-size: 11px; color: var(--muted); }
  .ni { font-size: 16px; width: 22px; text-align: center; }
  .nn { flex: 1; font-size: 13px; }
  .srow { display: flex; align-items: center; justify-content: space-between; padding: 8px 0; }
  .sn { font-size: 12.5px; color: var(--text-2); }
  input[type="time"] { background: rgba(255, 255, 255, 0.06); border: none; border-radius: 9px; color: var(--text); font-size: 12.5px; padding: 7px 10px; color-scheme: dark; }
  select { width: 100%; background: rgba(255, 255, 255, 0.06); border: none; border-radius: 11px; color: var(--text); font-size: 13px; padding: 12px; color-scheme: dark; }
  .note { font-size: 11.5px; color: var(--muted); margin-top: 10px; }
  .note code { background: rgba(255, 255, 255, 0.08); padding: 1px 5px; border-radius: 5px; font-size: 11px; }
  .fld { display: flex; flex-direction: column; gap: 5px; margin-bottom: 12px; }
  .fld span { font-size: 11.5px; font-weight: 600; color: var(--muted); }
  .fld input { background: rgba(255, 255, 255, 0.06); border: none; border-radius: 11px; color: var(--text); font-size: 13.5px; padding: 12px 14px; outline: none; }
  .btnrow { display: flex; gap: 9px; flex-wrap: wrap; }
  .btnrow .save { padding: 12px 22px; border-radius: 12px; background: var(--grad); color: #0b1017; font-size: 13px; font-weight: 800; }
  .btnrow .ghost { padding: 12px 18px; border-radius: 12px; background: rgba(255, 255, 255, 0.08); color: var(--text); font-size: 13px; font-weight: 600; }
  .btnrow button:disabled { opacity: 0.55; }
  .presets { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 9px; margin-bottom: 14px; }
  .preset { padding: 12px 14px; border-radius: 13px; background: rgba(255, 255, 255, 0.045); text-align: left; font-size: 12.5px; font-weight: 600; }
  .preset:hover { background: rgba(255, 255, 255, 0.09); }
  .composer { display: flex; gap: 9px; }
  .composer input { flex: 1; background: rgba(255, 255, 255, 0.06); border: none; border-radius: 12px; color: var(--text); font-size: 13px; padding: 12px 14px; outline: none; }
  .send { padding: 12px 22px; border-radius: 12px; background: var(--grad); color: #0b1017; font-size: 13px; font-weight: 800; }
  .views { display: flex; gap: 9px; flex-wrap: wrap; }
  .vchip { display: inline-flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: 12px; background: rgba(255, 255, 255, 0.045); font-size: 12px; font-weight: 600; }
  .vchip.on { background: var(--soft); box-shadow: inset 0 0 0 1.5px var(--line); }
  .guestrow { padding: 12px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.06); }
  .grtop { display: flex; align-items: center; gap: 11px; margin-bottom: 10px; }
  .gviews { display: flex; gap: 7px; flex-wrap: wrap; }
  .gviews .vchip { padding: 6px 11px; font-size: 11px; border-radius: 9px; }
  .loglist { display: flex; flex-direction: column; }
  .logrow { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.05); font-size: 12.5px; }
  .lgwho { font-weight: 600; min-width: 120px; }
  .lgev { flex: 1; color: var(--text-2); }
  .lgrole { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); }
  .lgrole.guest { color: var(--acc); }
  .lgt { font-size: 11px; color: var(--muted-2); white-space: nowrap; }
  .tvlink { padding: 16px 20px; font-size: 12.5px; color: var(--text-2); }
  .tvbtn { color: var(--water); font-weight: 600; }
</style>
