# HA Portal — Design Brief & Data Catalog

> A self-contained handoff for **Claude Design** (or any designer) to propose layouts and
> interactions for the HA Portal dashboard. It describes what the app *is*, what it can *read*
> and *do* on Home Assistant, the established visual language, and the full data catalog with
> real entity IDs and realistic sample values. Pair it with the live app for reference:
> **https://helloliam-ha-dashboard.web.app** (append `?mock=1` for the offline demo dataset).

---

## 1. What HA Portal is (and what it is NOT)

HA Portal is a **custom web app** — Svelte 5 + Vite + TypeScript, hosted on Firebase — that
connects **directly to Home Assistant** over the WebSocket API (via the Nabu Casa remote URL,
HA OAuth login). It is a bespoke replacement for the owner's Home Assistant Lovelace dashboards.

> ⚠️ **This is NOT Home Assistant Lovelace.** There are **no card constraints, no YAML, no
> `custom:` element rules, no masonry/column limits, no theme system to fight.** It is a normal
> web app — anything you can express in HTML/CSS/JS, we can build. Design with **full creative
> freedom**; Claude Code implements your design in Svelte components and wires it to live data.

**Runtime facts that shape design:**
- **Real-time.** Every entity state streams live over WebSocket and re-renders instantly. No polling, no refresh.
- **History.** Any numeric sensor's history (hours → days) can be fetched for charts/sparklines.
- **Responsive.** One app serves **desktop and mobile**; design both. (Current nav is a sticky top pill bar that scrolls horizontally on mobile.)
- **Stateful controls.** Toggles/actions call HA services and reflect the result live.
- **Auth.** OAuth is **per-origin** (login once per URL). No secrets in the client.

---

## 2. Established visual language — "Aurora Glass" (keep / evolve, don't replace)

The owner explicitly moved **away from the Home Assistant look**. The chosen direction is
**Aurora Glass** with a **violet/indigo** accent. Stay in this family; refine spacing,
hierarchy, motion and componentry, but don't regress to flat dark cards.

**Backdrop:** deep indigo→violet→black gradient with two large, slowly **drifting blurred glow
orbs** for depth. Fixed to the viewport.

**Surfaces:** frosted **glass** — translucent white fill, `backdrop-filter: blur(22px)
saturate(150%)`, 1px light top edge, soft drop shadow. Large radii.

**Design tokens (current):**

| Token | Value |
|---|---|
| App background | `#08070f` + layered violet radial gradients + drifting orbs |
| Glass card fill | `rgba(255,255,255,0.055)` + `blur(22px) saturate(150%)` |
| Card border | `rgba(255,255,255,0.10)` (light edge) |
| Card shadow | `0 10px 34px -12px rgba(0,0,0,.6)`, inset top highlight |
| Text / secondary / muted | `#f3f2fb` / `#b7b4cc` / `#837f9a` |
| **Accent (brand)** | `#a78bfa` violet · alt `#818cf8` indigo |
| Accent gradient | `linear-gradient(135deg,#818cf8,#a855f7)` |
| Accent glow | `rgba(139,92,246,0.55)` (used on active controls) |
| Success / Warning / Error | `#34d399` / `#fbbf24` / `#fb7185` |
| Water / Solar | `#38bdf8` / `#fbbf24` |
| Radii | hero 24 · card 18 · tile 16 · pill 999 |
| Font | system stack (`-apple-system, "Segoe UI", system-ui`) |

**Type ramp:** gradient greeting headline (32/800); KPI big number (40/700, −1.3px); uppercase
micro-labels (11/700, 1.6px tracking, muted); foot stats (10.5px uppercase).

**Motion:** smooth fades, drifting backdrop orbs, glow pulses on active tiles, animated
power-flow dashes. Respect `prefers-reduced-motion`.

---

## 3. What the dashboard can DO — capabilities & actions

### 3a. Read (all live)
- **Any entity's** current `state`, all `attributes`, `friendly_name`, `unit_of_measurement`.
- **Live subscription** to every entity — states update in real time.
- **History series** for any numeric sensor (used for area charts, sparklines, bar charts; e.g. 24h battery, 48h tank, 7-day usage buckets).

### 3b. Control — wired today
| Action | HA service | Applies to |
|---|---|---|
| Toggle | `homeassistant.toggle` | lights, switches, groups, fans |
| Turn on / off | `homeassistant.turn_on` / `turn_off` | any switchable entity |
| Bulk "all lights off" | `homeassistant.turn_off` (list) | all light/switch light entities |
| Arm away / arm home | `alarm_control_panel.alarm_arm_away` / `alarm_arm_home` | alarm panel (two-tap confirm) |
| Disarm | `alarm_control_panel.alarm_disarm` | alarm panel (two-tap confirm) |

### 3c. Control — readily addable (services exist in HA; just need UI + wiring)
Design freely for these — they're a small implementation step:
- **Lights:** brightness (`light.turn_on` `brightness_pct`), colour (`rgb_color`), colour temp, effects → **sliders, colour wheels, scenes**.
- **Fans / covers / locks:** `fan.set_percentage`, `cover.open_cover`/`close_cover`/`set_cover_position`, `lock.lock`/`unlock`.
- **Scenes & scripts:** `scene.turn_on`, `script.turn_on` → **quick-action buttons** ("Goodnight", "Movie", "Away"). *(scenes.yaml & scripts.yaml exist on the system.)*
- **Automation tuning inputs (the "Settings" surface):** `input_boolean.toggle`, `input_number.set_value`, `input_select.select_option`, `input_datetime.set_datetime` → **toggles, sliders, time pickers, dropdowns** (see §5).
- **Cameras:** still snapshots and/or HLS/WebRTC live streams (Frigate + HIK cameras exist) → **a Cameras view with thumbnails/feeds**.
- **Zone bypass:** `input_select.zone_bypass_selector` + a confirm → bypass a security zone.
- **Notifications / TTS / broadcast:** `notify.*`, `tts.*` → send a message or announce.

> ⚠️ **No `climate` entities today** — room temperatures are read-only **sensors**, not
> thermostats. Design temperature as *monitoring* (trends, comfort), not setpoint control,
> unless a climate device is added later.

---

## 4. Data catalog

Grouped, with real entity IDs, friendly names, realistic sample values and units. `⚠` = dead /
flaky / unavailable — **do not feature**. (Values captured from a live snapshot; treat as
realistic placeholders. Any entity below is live-readable by the app.)

### Energy · Solar · Battery (Victron)
| Entity | Name | Sample | Unit |
|---|---|---|---|
| `sensor.victron_battery_soc` | Battery SOC | 76 | % |
| `sensor.victron_battery_power` | Battery Power (− = discharging) | −939 | W |
| `sensor.victron_battery_state_text` | Battery State | Discharging | |
| `sensor.victron_battery_voltage` | Battery Voltage | 52.2 | V |
| `sensor.victron_battery_temperature` | Battery Temp | 20 | °C |
| `sensor.victron_total_pv_power` | Total PV Power | 0–2200 | W |
| `sensor.victron_total_pv_yield_today` | PV Yield Today | 2.72 | kWh |
| `sensor.victron_grid_total_power` | Grid Power (+ = import) | 10 | W |
| `sensor.victron_grid_import_today` | Grid Import Today | 3.15 | kWh |
| `sensor.victron_grid_import_this_month` | Grid Import Month | 150.8 | kWh |
| `sensor.victron_ac_consumption_l1` | House Load (L1) | 814 | W |
| `sensor.victron_essential_loads` | Essential Loads | 840 | W |
| `sensor.victron_non_essential_loads` | Non-Essential Loads | −26 | W |
| `sensor.victron_inverter_state_text` | Inverter State | Bulk | |
| `sensor.victron_grid_lost_alarm` | Grid Lost Alarm | 0 | |
| `sensor.grid_independence_today` | Grid Independence Today | 87.4 | % |
| `sensor.grid_independence_this_month` | Grid Independence Month | 73.5 | % |
| `sensor.grid_free_night_streak` | Grid-Free Night Streak | 41 | nights |
| `sensor.solar_yield_today` | Solar Yield Today | 2.71 | kWh |
| `sensor.solar_yield_this_week` | Solar Yield Week | 12.72 | kWh |
| `sensor.solar_yield_this_month` | Solar Yield Month | 54.56 | kWh |
| `sensor.expected_solar_yield_today` | Expected Yield Today | 20.0 | kWh |
| `sensor.solar_self_consumption_rate` | Self-Consumption Rate | 100 | % |
| `sensor.total_solar_savings` | Total Solar Savings | 32324 | R |
| `sensor.battery_health_score` | Battery Health | 100 | % |
| `counter.battery_cycle_count` | Battery Cycles | 112 | |
| `sensor.stats_battery_soc_30_day_average` | 30-day Avg SOC | 72.6 | % |
| `sensor.energy_cost_today` | Energy Cost Today | 100.24 | R |
| `sensor.energy_cost_projected_monthly` | Projected Monthly Cost | 2659 | R |
| `sensor.energy_report_card` | Energy Grade | B | |
| `sensor.critical_loads_energy_today` | Critical Loads Today | 1.94 | kWh |
| `sensor.daily_energy_attribution` | Daily Energy Attribution | 11.7 | kWh |
| `sensor.total_monitored_loads` | Monitored Loads | 274 | W |
| `sensor.estimated_unmonitored_loads` | Unmonitored Loads | 540 | W |
| `sensor.low_battery_devices` | Low-battery Devices | 1 | |
| `sensor.battery_runtime_at_current_load` | Runtime at Load | ⚠ unknown | h |

### Water · Tank · Pumps
| Entity | Name | Sample | Unit |
|---|---|---|---|
| `sensor.jojo_tank_monitor_tank_water_level` | Tank Level | 99.1 | % |
| `sensor.jojo_tank_monitor_tank_water_volume` | Tank Volume | 9910 | L |
| `sensor.jojo_tank_monitor_tank_status` | Tank Status | Full | |
| `sensor.jojo_tank_days_remaining` | Days Remaining | 72.9 | days |
| `binary_sensor.jojo_tank_monitor_tank_low_water_alert` | Low-water Alert | off | |
| `sensor.jojo_tank_flow_rate` | Tank Flow Rate | −2.01 | L/min |
| `sensor.water_used_today` | Water Used Today | 117 | L |
| `sensor.water_used_yesterday` | Water Used Yesterday | 136 | L |
| `sensor.average_daily_water_usage_7_days` | 7-day Avg Usage | 125 | L/day |
| `sensor.borehole_pump_water_pumped_today` | Borehole Today | 186 | L |
| `sensor.borehole_pump_water_pumped_this_month` | Borehole Month | 31456 | L |
| `sensor.borehole_pump_status` | Borehole Status | Idle | |
| `sensor.borehole_pump_power_now` | Borehole Power | 0 | W |
| `sensor.pool_pump_status` | Pool Pump Status | Idle | |
| `sensor.pool_pump_avg_power` | Pool Pump Avg Power | 466 | W |
| `sensor.pool_pump_energy_today` | Pool Pump Energy Today | 2.11 | kWh |
| `sensor.pool_pump_cost_today` | Pool Pump Cost Today | 7.38 | R |
| `sensor.water_pump_current_consumption` | Water Pump Power | 2.9 | W |
| `sensor.water_pump_energy_today` | Water Pump Energy Today | 0.366 | kWh |
| `sensor.water_pump_cost_today` | Water Pump Cost Today | 1.28 | R |
| `switch.water_pump` | **Water Pump** (control) | on | |
| `switch.pool_pump` | **Pool Pump** (control) | off | |
| `switch.borehole_pump` | **Borehole Pump** (control) | off | |
| `camera.…_1801` | JoJo Tank camera | idle | |

### Climate (read-only sensors — no thermostat)
| Entity | Name | Sample | Unit |
|---|---|---|---|
| `sensor.indoor_average_temperature` | Indoor Average | 16.0 | °C |
| `sensor.main_room_temperature` | Main Room | 16.7 | °C |
| `sensor.liam_s_room_temperature` | Liam's Room | 16.68 | °C |
| `sensor.kitchen_sensor_temperature` | Kitchen | 15.94 | °C |
| `sensor.living_room_sensor_temperature` | Living Room | 15.41 | °C |
| `sensor.study_temperature` | Study | 17.8 | °C |
| `sensor.patio_sensor_temperature` | Patio | 13.98 | °C |
| `sensor.back_yard_temperature` | Back Yard | 12.1 | °C |
| `sensor.main_bedroom_lamp_si7021_humidity` | Main Room Humidity | 68.5 | % |
| `sensor.liam_s_room_humidity` | Liam's Room Humidity | 60.3 | % |
| `sensor.kitchen_sensor_humidity` | Kitchen Humidity | 69.1 | % |
| `sensor.living_room_sensor_humidity` | Living Room Humidity | 68.2 | % |
| `sensor.patio_sensor_humidity` | Patio Humidity | 64.1 | % |
| `weather.home` | Weather (condition + temp attr) | clear-night | |
| `sensor.adjusted_temperature` | Eben's Room | ⚠ −0.6 (dead) | °C |

### Occupancy & Presence
| Entity | Name | Sample |
|---|---|---|
| `sensor.home_occupancy` | Home Occupancy | Occupied / Asleep / Empty… |
| `sensor.home_occupancy_confidence` | Occupancy Confidence | % |
| `binary_sensor.nobody_home` | Nobody Home | on/off |
| `binary_sensor.house_interior_motion` | Interior Motion | on/off |
| `binary_sensor.lounge_lounge_occupancy_sensor` | Lounge mmWave | on/off |
| `binary_sensor.helloliam_alarm_zone_00X_pir_*` | 10× room PIRs (guest, kids, TV, lounge, kitchen, garage, front door, roof, passage, main) | off |
| `binary_sensor.main_gate_ai_person_occupancy` | Gate Person Present | off |
| `binary_sensor.main_gate_ai_car_occupancy` | Gate Car Present | off |

### Security & Alarm
| Entity | Name | Sample |
|---|---|---|
| `alarm_control_panel.helloliam_alarm_area_01_huis` | **House alarm** (code-free, controllable) | disarmed |
| `alarm_control_panel.helloliam_alarm_area_02_beams` | **Beams alarm** (code-free) | disarmed |
| `alarm_control_panel.olarm_alarm` | Olarm mirror (code required) | disarmed |
| `alarm_control_panel.olarm_beams` | Olarm beams mirror | disarmed |
| `binary_sensor.helloliam_alarm_ac_power` | Alarm AC Power | on |
| `sensor.alarm_bypassed_zones_2` | Bypassed Zones | 0 |
| `binary_sensor.helloliam_alarm_zone_0XX_*` | ~31 zones: doors, windows, beams (driveway, pool, patio, garage, back garden, gate→back, bedroom windows, store room…), panic, remotes | off |
| `switch.dining_room_alarm_cctv_power_monitor` | Alarm/CCTV Power | on |
| `sensor.dining_room_alarm_cctv_power_monitor_power` | Alarm/CCTV Power draw | 91.4 W |

### Cameras & Traffic (Frigate / ANPR / sidewalk analytics)
| Entity | Name | Sample |
|---|---|---|
| `camera.main_gate`, `camera.main_gate_ai`, `camera.sidewalk_ai` | Gate + AI cameras (recording) | |
| `camera.…_201/301/401/501/601/1701/1901/2001/2101` | Back Yard, Front Yard, Carport, Pool, Driveway, Road, Main Gate feeds | idle |
| `counter.frigate_main_gate_detections_today` | Gate Detections Today | 22 |
| `counter.frigate_vehicle_detections_today` | Vehicle Detections | 21 |
| `counter.frigate_person_detections_today` | Person Detections | 1 |
| `sensor.main_gate_ai_last_recognized_plate` | Last Plate (ANPR) | None |
| `sensor.vehicles_today` / `_this_week` / `_this_month` | Vehicles | 935 / 3582 / 7232 |
| `sensor.pedestrians_today` / `_this_week` / `_this_month` | Pedestrians | 50 / 427 / 2098 |
| `sensor.sidewalk_traffic_intensity` | Traffic Intensity | Moderate |
| `sensor.sidewalk_{morning,afternoon,evening,night}_traffic` | Traffic by time of day | 19 / 9 / 0 / 0 | people |
| `sensor.sidewalk_vehicles_total` / `_pedestrians_total` | All-time totals | 20078 / 10171 |

### Power & Devices (per-plug + appliance switches)
| Entity | Name | Sample | Control |
|---|---|---|---|
| `switch.dishwasher` + `sensor.dishwasher_power` | Dishwasher | on · 0 W | ✅ switch |
| `switch.washing_machine` + `sensor.washing_machine_energy_power` | Washer (Front Loader) | on · 2 W | ✅ switch |
| `switch.tumble_dryer` + `sensor.tumble_dryer_energy_power` | Dryer | on · 0 W | ✅ switch |
| `switch.kettle` + `sensor.kettle_power` | Kettle | on · 0 W | ✅ switch |
| `switch.microwave` + `sensor.microwave_current_consumption` | Microwave | on · 0.8 W | ✅ switch |
| `switch.kitchen_air_fryer` + `sensor.kitchen_air_fryer_power` | Air Fryer | on · 0 W | ✅ switch |
| `switch.nespresso` + `sensor.nespresso_current_consumption` | Nespresso | on · 0 W | ✅ switch |
| `switch.work_pc` + `sensor.work_pc_current_consumption` | Work PC | on · 202 W | ✅ switch |
| `switch.study_heater` + `sensor.study_heater_current_consumption` | Study Heater | off · 0 W | ✅ switch |
| `switch.top_loader` + `sensor.top_loader_current_consumption` | Top Loader | on · 0.5 W | ✅ switch |
| `sensor.main_fridge_current_consumption` | Main Fridge | 46.5 W | read |
| `binary_sensor.good_time_for_appliances` | Good Time to Run Appliances | off | read |
| ⚠ avoid `*_power_usage` variants | (bogus — gave 742 kW / 12718 W readings) | | |

### Lights & Lamps
| Entity | Name | State | Control |
|---|---|---|---|
| `switch.kitchen_lights` | Kitchen Lights | off | ✅ |
| `switch.kitchen_under_counter_lights` | Under-counter Lights | on | ✅ |
| `switch.living_room_lamp` | Living Room Lamp | off | ✅ |
| `switch.tv_room_lamp` | TV Room Lamp | off | ✅ |
| `switch.main_bedroom_lamp` | Main Bedroom Lamp | on | ✅ |
| `light.study_lamp` | Study Lamp | on | ✅ (dimmable-capable) |
| `light.eben_room_lamp` | Eben Room Lamp | off | ✅ |
| `light.dining_room_lamp` | Dining Room Lamp | off (⚠ flaky LQI) | ✅ |
| `group.room_lamps` | Room Lamps (group) | on | ✅ |
| `group.lounge_lamps` | Lounge Lamps (group) | off | ✅ |
| `light.street_lights` | Street Lights | on | ✅ |
| `switch.driveway_lights_switch` | Driveway Lights | off | ✅ |
| `switch.gate_spotlight` | Gate Spotlight | off | ✅ |
| `light.back_yard_fire_pit_light` | Fire Pit Light | on | ✅ |
| `light.study_yard_light` | Study Yard Light | off | ✅ |
| ⚠ `light.lamps` | has dead members (living_room, tv_room_light) — prefer the groups/switches above | | |
| ⚠ `switch.patio_lamp`, `light.back_yard_pool_light`, `light.study_light_1/2` | unavailable | | |

### Network · System · Health
| Entity | Name | Sample | Unit |
|---|---|---|---|
| `sensor.fibre_router_download_speed` / `_upload_speed` | Internet speed | 0.08 / 0.04 | Mbit/s |
| `sensor.fibre_router_devices_connected` | Devices Online | 40 | |
| `sensor.fibre_router_cpu_usage` | Router CPU | 3.33 | % |
| `sensor.fibre_router_memory_usage` | Router Memory | 91.08 | % |
| `sensor.fibre_router_uptime` | Router Uptime | 3593823 | s |
| `sensor.fibre_router_download` / `_upload` | Data transferred | 1500 / 507 | GB |
| `device_tracker.kitchen_deco` / `main_living_room_deco` / `study_deco` | Deco mesh nodes | home | |
| `sensor.brother_dcp_t720dw` | Printer status | idle | |
| `sensor.brother_dcp_t720dw_{bk,c,m,y}` | Printer ink levels | 43 / 31 / 37 / 31 | % |

### Notifications & Status feeds
| Entity | Name | Notes |
|---|---|---|
| `sensor.home_notices` | Home Notices | crucial-only alerts + last-night sleep (markdown attr) |
| `sensor.sleep_summary` | Sleep Summary | |
| `sensor.loadshedding` | Load-shedding schedule/stage | |

---

## 5. Settings / automation-tuning surface (controllable inputs)

The old HA "Settings" dashboard exposed **helper inputs that tune the automations**. These are
all controllable from the web app (`input_boolean.toggle`, `input_number.set_value`,
`input_datetime.set_datetime`, `input_select.select_option`) and are a natural **"Settings"
view**:

| Entity | Name | Sample | Control type |
|---|---|---|---|
| `input_boolean.alarm_auto_arm_away` | Auto Arm — Away | off | toggle |
| `input_boolean.alarm_auto_arm_stay` | Auto Arm — Stay | off | toggle |
| `input_boolean.alarm_auto_arm_beams` | Auto Arm — Beams | on | toggle |
| `input_boolean.alarm_auto_disarm` | Auto Disarm | on | toggle |
| `input_boolean.alarm_auto_disarm_beams` | Auto Disarm — Beams | on | toggle |
| `input_datetime.alarm_auto_arm_away_time` | Auto Arm Away time | 17:00 | time picker |
| `input_datetime.alarm_auto_arm_stay_time` | Auto Arm Stay time | 22:00 | time picker |
| `input_datetime.alarm_auto_arm_time_beams` | Beams Auto Arm time | 22:10 | time picker |
| `input_datetime.alarm_auto_disarm_time` | Auto Disarm time | 06:00 | time picker |
| `input_datetime.alarm_auto_disarm_time_beams` | Beams Auto Disarm time | 06:05 | time picker |
| `input_select.zone_bypass_selector` | Zone to Bypass | Zone 22… | dropdown |
| `input_boolean.printer_ink_notifications` | Printer Ink Low Notifications | on | toggle |

> There are **more tuning inputs** on the HA system (camera detection sensitivity, evening/night
> lights, occupancy tuning, intelligence advisories, messages, market data). If a full Settings
> view is in scope, we can enumerate the complete `input_*` set — design a flexible, grouped
> settings pattern (sections of toggles / sliders / time pickers / dropdowns).

---

## 6. Current app — view inventory (what exists today)

Seven views, all Aurora Glass. Use as the baseline to critique/redesign.

1. **Home** — gradient greeting + live alarm pill; **Quick Actions** row (arm/disarm, all-lights-off, water/pool/borehole pumps); live **power-flow diagram**; at-a-glance KPI gauges (battery, solar, grid independence, tank); indoor + outdoor **light toggles**; comfort strip (room temps).
2. **Energy** — animated power flow; battery/solar/load/grid KPIs; **battery & solar 24h area charts**; **7-day solar-yield bars**; energy stats grid; appliance switches with live wattage.
3. **Water** — tank gauge; **48h tank-level trend**; water-used & borehole **7-day bars**; pump controls.
4. **Climate** — indoor average + 24h trend; per-room cards (temp, humidity, **24h sparkline**), colour-coded by comfort.
5. **Security** — big status card; **two-tap arm/disarm**; live zone grid (active/clear); AC-power & bypass pills.
6. **Traffic** — vehicle/pedestrian KPIs; **sidewalk traffic by time-of-day bars**; ANPR plate; monthly analytics.
7. **System** — internet speed/uptime; router **CPU/memory ring gauges**; devices-online 24h; mesh nodes; **printer ink bars**; battery health.

---

## 7. Existing component library (compose freely, or propose new)

Reusable Svelte components already built (all Aurora Glass): **KpiCard** (icon, label, big value,
foot stats, accent glow, optional gauge slot), **RingGauge** (SVG donut), **TankGauge** (SVG
fill), **AreaChart** (gradient area + axis), **BarChart** (labelled bars), **PowerFlow** (animated
source→house→battery/grid diagram), **Tile** (quick-action / toggle with glow), **Pill** (status
chip), **BarRow** (labelled progress bar), **Section** (uppercase heading + grid).

---

## 8. Owner's design goals (the brief)

- **Modern, sleek, not Home Assistant.** Aurora Glass, violet/indigo, depth and motion.
- **Clean & uncluttered** — generous spacing, clear hierarchy, fewer competing elements.
- **Focused on what matters day-to-day** — be opinionated; demote the rest.
- **Quick actions one tap away & prominent** — lights/scenes, arm/disarm, pumps, "Goodnight".
- **Two tailored experiences** — desktop = wide command centre; mobile = thumb-first, short scroll.

**Candidate features to design for** (not yet built, all feasible): light **brightness/colour
sliders**; **scenes** (Goodnight/Movie/Away); a **Cameras** view with live thumbnails; a full
**Settings** view (§5); **favourites**/reorderable Home; **PWA** install.

---

## 9. Handoff workflow (Claude Design → Claude Code)

1. **Claude Design** (claude.ai) critiques the current app + this brief, proposes a direction,
   and builds **HTML/interactive Artifacts** to preview — using the realistic values in §4 and
   the Aurora Glass tokens in §2. Design **desktop and mobile**.
2. Bring the approved design **back to Claude Code**, which rebuilds it as Svelte components,
   wires the real entity IDs (§4) and actions (§3), verifies against the live/mock app, and
   deploys to Firebase.

*Unlike Home Assistant, there are no card/render constraints — design for the web, not for
Lovelace.*
