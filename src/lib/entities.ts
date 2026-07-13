// Real entity IDs from the live snapshot (DASHBOARD_DATA_SNAPSHOT.md).
// Dead/flaky entities flagged in the brief are deliberately excluded.

export const E = {
  // Energy / solar / battery (Victron)
  batterySoc: "sensor.victron_battery_soc",
  batteryPower: "sensor.victron_battery_power",
  batteryState: "sensor.victron_battery_state_text",
  batteryVoltage: "sensor.victron_battery_voltage",
  batteryTemp: "sensor.victron_battery_temperature",
  pvPower: "sensor.victron_total_pv_power",
  pvYieldToday: "sensor.victron_total_pv_yield_today",
  gridPower: "sensor.victron_grid_total_power",
  gridImportToday: "sensor.victron_grid_import_today",
  loads: "sensor.victron_ac_consumption_l1",
  essentialLoads: "sensor.victron_essential_loads",
  inverterState: "sensor.victron_inverter_state_text",
  gridIndepToday: "sensor.grid_independence_today",
  gridIndepMonth: "sensor.grid_independence_this_month",
  gridFreeStreak: "sensor.grid_free_night_streak",
  solarYieldToday: "sensor.solar_yield_today",
  solarYieldWeek: "sensor.solar_yield_this_week",
  solarYieldMonth: "sensor.solar_yield_this_month",
  solarSavings: "sensor.total_solar_savings",
  batteryHealth: "sensor.battery_health_score",
  energyCostToday: "sensor.energy_cost_today",
  energyCostMonth: "sensor.energy_cost_projected_monthly",
  energyGrade: "sensor.energy_report_card",
  gridLostAlarm: "sensor.victron_grid_lost_alarm",

  // Water
  tankLevel: "sensor.jojo_tank_monitor_tank_water_level",
  tankVolume: "sensor.jojo_tank_monitor_tank_water_volume",
  tankStatus: "sensor.jojo_tank_monitor_tank_status",
  tankDays: "sensor.jojo_tank_days_remaining",
  tankLowAlert: "binary_sensor.jojo_tank_monitor_tank_low_water_alert",
  waterUsedToday: "sensor.water_used_today",
  waterUsedYesterday: "sensor.water_used_yesterday",
  waterAvg7d: "sensor.average_daily_water_usage_7_days",
  boreholeToday: "sensor.borehole_pump_water_pumped_today",
  boreholeMonth: "sensor.borehole_pump_water_pumped_this_month",
  boreholeStatus: "sensor.borehole_pump_status",
  poolPumpStatus: "sensor.pool_pump_status",

  // Climate — [entity, label]
  indoorAvg: "sensor.indoor_average_temperature",
  weather: "weather.home",

  // Security
  alarmMain: "alarm_control_panel.olarm_alarm",
  alarmBeams: "alarm_control_panel.olarm_beams",
  alarmArmTarget: "alarm_control_panel.helloliam_alarm_area_01_huis",
  // The two controllable HelloLiam areas (arm home/away/night + disarm, no code).
  alarmHome: "alarm_control_panel.helloliam_alarm_area_01_huis",
  alarmBeamsArea: "alarm_control_panel.helloliam_alarm_area_02_beams",
  alarmAcPower: "binary_sensor.helloliam_alarm_ac_power",
  bypassedZones: "sensor.alarm_bypassed_zones_2",

  // Occupancy
  occupancy: "sensor.home_occupancy",

  // Cameras / traffic
  vehiclesToday: "sensor.vehicles_today",
  vehiclesWeek: "sensor.vehicles_this_week",
  vehiclesMonth: "sensor.vehicles_this_month",
  pedestriansToday: "sensor.pedestrians_today",
  pedestriansWeek: "sensor.pedestrians_this_week",
  pedestriansMonth: "sensor.pedestrians_this_month",
  gateDetections: "counter.frigate_main_gate_detections_today",
  personDetections: "counter.frigate_person_detections_today",
  vehicleDetections: "counter.frigate_vehicle_detections_today",
  lastPlate: "sensor.last_recognized_plate",
  knownPlates: "input_text.known_vehicle_plates",
  plateOwner: "sensor.main_gate_plate_owner",
  trafficIntensity: "sensor.sidewalk_traffic_intensity",
  trafficMorning: "sensor.sidewalk_morning_traffic",
  trafficAfternoon: "sensor.sidewalk_afternoon_traffic",
  trafficEvening: "sensor.sidewalk_evening_traffic",
  trafficNight: "sensor.sidewalk_night_traffic",

  // System / network / health
  routerCpu: "sensor.fibre_router_cpu_usage",
  routerMem: "sensor.fibre_router_memory_usage",
  routerDevices: "sensor.fibre_router_devices_connected",
  routerDown: "sensor.fibre_router_download_speed",
  routerUp: "sensor.fibre_router_upload_speed",
  routerUptime: "sensor.fibre_router_uptime",
  lowBatteryDevices: "sensor.low_battery_devices",
  monitoredLoads: "sensor.total_monitored_loads",
  unmonitoredLoads: "sensor.estimated_unmonitored_loads",
  powerReconciliation: "sensor.power_reconciliation",
  costAttribution: "sensor.energy_cost_attribution",
  printer: "sensor.brother_dcp_t720dw",
  inkBk: "sensor.brother_dcp_t720dw_bk",
  inkC: "sensor.brother_dcp_t720dw_c",
  inkM: "sensor.brother_dcp_t720dw_m",
  inkY: "sensor.brother_dcp_t720dw_y",

  // Pumps & heater
  waterPump: "switch.water_pump",
  poolPump: "switch.pool_pump",
  boreholePump: "switch.borehole_pump",

  // Pump live power + detail (idle ≈ a few W, pumping = hundreds of W)
  waterPumpPower: "sensor.water_pump_power",
  poolPumpPower: "sensor.pool_pump_power_now",
  boreholePower: "sensor.borehole_pump_power_now",
  boreholeFlow: "sensor.borehole_pump_actual_flow_rate",
  boreholeRunToday: "sensor.borehole_pump_run_time_today",
  boreholeEnergyToday: "sensor.borehole_pump_energy",
  boreholeCostToday: "sensor.borehole_pump_cost_today",
  // Borehole efficiency / wear (L pumped per kWh — falls as the pump/impeller wears or an intake clogs)
  boreholeEfficiency: "sensor.borehole_pump_efficiency",
  boreholeCostPerL: "sensor.borehole_pump_cost_per_liter",
  boreholeAvgPower: "sensor.borehole_pump_avg_power",
  boreholeCostMonth: "sensor.borehole_pump_cost_this_month",
  tariff: "input_number.electricity_tariff",
  heater: "switch.study_heater",

  notices: "sensor.home_notices",

  // Occupancy / presence
  houseOccupied: "binary_sensor.house_occupied",
  interiorMotion: "binary_sensor.house_interior_motion",
  nobodyHome: "binary_sensor.nobody_home",

  // Quick-action scripts / scenes
  scGoodnight: "script.quick_goodnight_scene",
  scMovie: "script.movie_mode",
  scAway: "script.quick_away_mode",
  scMorning: "script.quick_good_morning_scene",
  scLightsOff: "script.quick_lights_all_off",

  // Irrigation (Wyze)
  irrCurrentZone: "sensor.helloeben_sprinkler_current_zone",
  irrZoneSelect: "input_select.irrigation_zone_selector",
  irrRuntime: "input_number.irrigation_runtime_minutes",
  irrIntelligence: "input_boolean.irrigation_intelligence_enabled",
  irrTimeToday: "sensor.sprinkler_watering_time_today",
  irrTimeMonth: "sensor.sprinkler_watering_time_this_month",
  irrStartZone: "script.start_selected_irrigation_zone",
  irrStop: "script.stop_irrigation",
  irrStartAll: "script.quick_irrigation_start_all",
  irrStopAll: "script.quick_irrigation_stop_all",
  irrNextRun: "sensor.helloeben_sprinkler_next_scheduled_run",
  irrActiveSchedules: "sensor.helloeben_sprinkler_active_schedules",

  // Oura (health)
  ouraSleepScore: "sensor.oura_sleep_score",
  ouraReadiness: "sensor.oura_readiness_score",
  ouraActivityScore: "sensor.oura_activity_score",
  ouraTotalSleep: "sensor.oura_total_sleep_duration",
  ouraTimeInBed: "sensor.oura_time_in_bed",
  ouraDeep: "sensor.oura_deep_sleep_duration",
  ouraRem: "sensor.oura_rem_sleep_duration",
  ouraLightSleep: "sensor.oura_light_sleep_duration",
  ouraAwake: "sensor.oura_awake_time",
  ouraEfficiency: "sensor.oura_sleep_efficiency",
  ouraRestful: "sensor.oura_restfulness",
  ouraLatency: "sensor.oura_sleep_latency",
  ouraSleepHR: "sensor.oura_average_sleep_heart_rate",
  ouraSleepHRV: "sensor.oura_average_sleep_hrv",
  ouraCurrentHR: "sensor.oura_current_heart_rate",
  ouraRestingHR: "sensor.oura_lowest_sleep_heart_rate",
  ouraSteps: "sensor.oura_steps",
  coffeeLog: "sensor.coffee_log",
  meDeskTime: "sensor.me_desk_time_today",
  meTimeAway: "sensor.me_time_away_today",
  meStudyTime: "sensor.me_study_time_today",
  meKitchenTime: "sensor.me_kitchen_time_today",
  meLoungeTime: "sensor.me_lounge_time_today",
  ouraActiveCal: "sensor.oura_active_calories",
  ouraTotalCal: "sensor.oura_total_calories",
  ouraTargetCal: "sensor.oura_target_calories",
  ouraLowActivity: "sensor.oura_low_activity_time",
  ouraRingBatt: "sensor.oura_ring_battery_level",
  ouraBedStart: "sensor.oura_bedtime_start",
  ouraBedEnd: "sensor.oura_bedtime_end",
  ouraTempDev: "sensor.oura_temperature_deviation",
  ouraSpo2: "sensor.oura_spo2_average",
  ouraWorkoutType: "sensor.oura_last_workout_type",
  ouraWorkoutIntensity: "sensor.oura_last_workout_intensity",
  ouraWorkoutDuration: "sensor.oura_last_workout_duration",
  ouraWorkoutDistance: "sensor.oura_last_workout_distance",
  ouraWorkoutCalories: "sensor.oura_last_workout_calories",
  ouraWorkoutsToday: "sensor.oura_workouts_today",
  ouraMedActivityMin: "sensor.oura_medium_activity_met_minutes",
  ouraHighActivityMin: "sensor.oura_high_activity_met_minutes",
} as const;

export type SceneDef = { id: string; label: string; icon: string };
export type Pump = { sw: string; power: string; flow: string | null; label: string; icon: string; threshold: number };
// threshold W above which the pump is actually moving water (vs just idling)
export const PUMPS: Pump[] = [
  { sw: "switch.water_pump", power: "sensor.water_pump_power", flow: null, label: "Water Pump", icon: "💧", threshold: 20 },
  { sw: "switch.borehole_pump", power: "sensor.borehole_pump_power_now", flow: "sensor.borehole_pump_actual_flow_rate", label: "Borehole", icon: "🕳️", threshold: 40 },
  { sw: "switch.pool_pump", power: "sensor.pool_pump_power_now", flow: null, label: "Pool Pump", icon: "🏊", threshold: 40 },
];

export const SCENES: SceneDef[] = [
  { id: "script.quick_goodnight_scene", label: "Goodnight", icon: "🌙" },
  { id: "script.movie_mode", label: "Movie", icon: "🎬" },
  { id: "script.quick_away_mode", label: "Away", icon: "🚪" },
  { id: "script.quick_good_morning_scene", label: "Morning", icon: "☀️" },
];

// Camera feeds (live streams need HLS/WebRTC wiring; shown as labelled tiles for now).
export const CAMERAS: { id: string; label: string; sub: string }[] = [
  { id: "camera.main_gate_ai", label: "Main Gate", sub: "ANPR" },
  { id: "camera.driveway_front_door_ai", label: "Driveway · Front Door", sub: "ANPR" },
  { id: "camera.gate_hires", label: "Gate", sub: "hi-res" },
  { id: "camera.sidewalk_ai", label: "Sidewalk", sub: "AI" },
  { id: "camera.store_room", label: "Store Room", sub: "indoor" },
  { id: "camera.ids_7216hqhi_m1_s1620231215ccwray1010746wcvu_201", label: "Back Yard", sub: "HIK" },
  { id: "camera.ids_7216hqhi_m1_s1620231215ccwray1010746wcvu_301", label: "Front Yard", sub: "HIK" },
  { id: "camera.ids_7216hqhi_m1_s1620231215ccwray1010746wcvu_501", label: "Pool", sub: "HIK" },
];

// Access & openings — read-only door/gate status (no cover/lock entities exist).
export const ACCESS: { id: string; label: string; icon: string }[] = [
  { id: "binary_sensor.helloliam_alarm_zone_013_front_door", label: "Front Door", icon: "🚪" },
  { id: "binary_sensor.helloliam_alarm_zone_020_door_kitchen", label: "Kitchen Door", icon: "🚪" },
  { id: "binary_sensor.helloliam_alarm_zone_024_door_lounge", label: "Lounge Door", icon: "🚪" },
  { id: "binary_sensor.helloliam_alarm_zone_030_beam_garage", label: "Garage", icon: "🏚️" },
  { id: "binary_sensor.helloliam_alarm_zone_015_beam_driveway", label: "Driveway", icon: "🚗" },
  { id: "binary_sensor.helloliam_alarm_zone_006_beam_gate_to_back", label: "Side Gate", icon: "🚧" },
];

// Irrigation zones — real Wyze/HelloEben zones with per-zone sensors.
export type IrrZone = { label: string; select: string; slug: string };
export const IRR_ZONES: IrrZone[] = [
  { label: "Sidewalk", select: "Zone 1: Sidewalk", slug: "sidewalk" },
  { label: "Gate / Front Yard", select: "Zone 2: Gate/Front Yard", slug: "gate_front_yard" },
  { label: "Front Garden", select: "Zone 3: Front Garden", slug: "front_garden" },
  { label: "Back Yard Grass", select: "Zone 4: Back Yard Grass", slug: "back_yard_grass" },
  { label: "Back Yard", select: "Zone 5: Back Yard", slug: "back_yard" },
  { label: "JoJo / Courtyard", select: "Zone 6: JoJo/Courtyard", slug: "jojo_courtyard" },
];
export const irrZoneSensor = (slug: string, kind: "remaining_time" | "soil_moisture" | "last_watered") =>
  `sensor.helloeben_sprinkler_${slug}_${kind}`;

export type Room = { id: string; label: string; humidity?: string };

// Room temperatures (dead sensors omitted: adjusted_temperature / Eben's room).
export const ROOMS: Room[] = [
  { id: "sensor.main_room_temperature", label: "Main Room", humidity: "sensor.main_bedroom_lamp_si7021_humidity" },
  { id: "sensor.liam_s_room_temperature", label: "Liam's Room", humidity: "sensor.liam_s_room_humidity" },
  { id: "sensor.kitchen_sensor_temperature", label: "Kitchen", humidity: "sensor.kitchen_sensor_humidity" },
  { id: "sensor.living_room_sensor_temperature", label: "Living Room", humidity: "sensor.living_room_sensor_humidity" },
  { id: "sensor.study_temperature", label: "Study" },
  { id: "sensor.patio_sensor_temperature", label: "Patio", humidity: "sensor.patio_sensor_humidity" },
  { id: "sensor.back_yard_temperature", label: "Back Yard" },
];

export type LightDef = { id: string; label: string; icon: string; members?: number };

export const INDOOR_LIGHTS: LightDef[] = [
  { id: "switch.kitchen_lights", label: "Kitchen", icon: "🍳" },
  { id: "switch.kitchen_under_counter_lights", label: "Under Counter", icon: "🔆" },
  { id: "switch.living_room_lamp", label: "Living Room", icon: "🛋️" },
  { id: "switch.tv_room_lamp", label: "TV Room", icon: "📺" },
  { id: "switch.main_bedroom_lamp", label: "Main Bedroom", icon: "🛏️" },
  { id: "light.study_lamp", label: "Study", icon: "📚" },
  { id: "group.room_lamps", label: "Room Lamps", icon: "💡" },
  { id: "group.lounge_lamps", label: "Lounge Lamps", icon: "🛋️" },
];

export const OUTDOOR_LIGHTS: LightDef[] = [
  { id: "light.street_lights", label: "Street", icon: "🛣️" },
  { id: "switch.driveway_lights_switch", label: "Driveway", icon: "🚗" },
  { id: "switch.gate_spotlight", label: "Gate Spot", icon: "🔦" },
  { id: "light.back_yard_fire_pit_light", label: "Fire Pit", icon: "🔥" },
  { id: "light.study_yard_light", label: "Study Yard", icon: "🌳" },
];

export type LightArea = { name: string; icon: string; lights: LightDef[] };

// Lights grouped into logical areas — source of truth for the Lights page.
// `group.*` entries carry a `members` count and render as group controls.
export const LIGHT_AREAS: LightArea[] = [
  { name: "Kitchen", icon: "🍳", lights: [
    { id: "switch.kitchen_lights", label: "Ceiling", icon: "🍳" },
    { id: "switch.kitchen_under_counter_lights", label: "Under Counter", icon: "🔆" },
  ] },
  { name: "Living & Dining", icon: "🛋️", lights: [
    { id: "switch.living_room_lamp", label: "Living Room", icon: "🛋️" },
    { id: "switch.tv_room_lamp", label: "TV Room", icon: "📺" },
    { id: "light.dining_room_lamp", label: "Dining", icon: "🍽️" },
    { id: "group.lounge_lamps", label: "Lounge Lamps", icon: "🗂️", members: 3 },
  ] },
  { name: "Bedrooms", icon: "🛏️", lights: [
    { id: "switch.main_bedroom_lamp", label: "Main Bedroom Lamp", icon: "🛏️" },
    { id: "light.main_bedroom_light", label: "Main Bedroom Light", icon: "💡" },
    { id: "light.main_bedroom_dresser_light", label: "Dresser", icon: "🪞" },
    { id: "light.eben_room_lamp", label: "Eben's Room", icon: "🛏️" },
    { id: "switch.guest_room", label: "Guest Room", icon: "🛏️" },
    { id: "group.room_lamps", label: "Room Lamps", icon: "🗂️", members: 3 },
  ] },
  { name: "Study", icon: "📚", lights: [
    { id: "light.study_lamp", label: "Study Lamp", icon: "📚" },
    { id: "light.study_light_1", label: "Study Light 1", icon: "💡" },
    { id: "light.study_light_2", label: "Study Light 2", icon: "💡" },
  ] },
  { name: "Outdoor & Yard", icon: "🌳", lights: [
    { id: "light.street_lights", label: "Street", icon: "🛣️" },
    { id: "switch.driveway_lights_switch", label: "Driveway", icon: "🚗" },
    { id: "switch.gate_spotlight", label: "Gate Spot", icon: "🔦" },
    { id: "switch.patio_lamp", label: "Patio", icon: "🪑" },
    { id: "light.back_yard_pool_light", label: "Pool", icon: "🏊" },
    { id: "light.back_yard_fire_pit_light", label: "Fire Pit", icon: "🔥" },
    { id: "light.study_yard_light", label: "Study Yard", icon: "🌳" },
  ] },
];

// Individual light entities (excludes group.* controls) — used for blanket
// "all off", the overview lit-count, and the per-area on/off counts.
export const ALL_LIGHTS = LIGHT_AREAS.flatMap((a) =>
  a.lights.filter((l) => !l.id.startsWith("group.")).map((l) => l.id),
);

export type Appliance = { sw: string; power: string; label: string; icon: string; threshold?: number };
export type ApplianceArea = { name: string; icon: string; items: Appliance[] };

// Appliances grouped into logical areas — source of truth for the Appliances page.
export const APPLIANCE_AREAS: ApplianceArea[] = [
  { name: "Kitchen", icon: "🍳", items: [
    { sw: "switch.main_fridge", power: "sensor.main_fridge_current_consumption", label: "Main Fridge", icon: "🧊" },
    { sw: "switch.dishwasher", power: "sensor.dishwasher_power", label: "Dishwasher", icon: "🍽️" },
    { sw: "switch.kettle", power: "sensor.kettle_power", label: "Kettle", icon: "☕" },
    { sw: "switch.microwave", power: "sensor.microwave_current_consumption", label: "Microwave", icon: "🍲" },
    { sw: "switch.kitchen_air_fryer", power: "sensor.kitchen_air_fryer_power", label: "Air Fryer", icon: "🍟" },
    { sw: "switch.nespresso", power: "sensor.nespresso_current_consumption", label: "Nespresso", icon: "☕" },
  ] },
  { name: "Laundry", icon: "🧺", items: [
    { sw: "switch.washing_machine", power: "sensor.washing_machine_energy_power", label: "Front Loader", icon: "🧺" },
    { sw: "switch.top_loader", power: "sensor.top_loader_current_consumption", label: "Top Loader", icon: "🧺" },
    { sw: "switch.tumble_dryer", power: "sensor.tumble_dryer_energy_power", label: "Tumble Dryer", icon: "🌀" },
  ] },
  { name: "Study & Office", icon: "💻", items: [
    { sw: "switch.work_pc", power: "sensor.work_pc_current_consumption", label: "Work PC", icon: "💻" },
    { sw: "switch.study_heater", power: "sensor.study_heater_current_consumption", label: "Study Heater", icon: "🔥" },
  ] },
  { name: "Security & Systems", icon: "🛡️", items: [
    { sw: "switch.dining_room_alarm_cctv_power_monitor", power: "sensor.dining_room_alarm_cctv_power_monitor_power", label: "Alarm & CCTV", icon: "🛡️" },
  ] },
];

// Flat list (derived) — used by the Energy view's live-draw grid.
export const APPLIANCES: Appliance[] = APPLIANCE_AREAS.flatMap((a) => a.items);

// A security zone with its live state, current bypass status, and the
// press-buttons that bypass / restore it (the proper per-zone bypass wiring).
export type AlarmZone = {
  n: string;
  label: string;
  id: string;
  bypass: string;
  bypassBtn: string;
  unbypassBtn: string;
};

// All 31 HelloLiam alarm zones (generated from the live entity registry).
export const ALARM_ZONES: AlarmZone[] = [
  { n: "001", label: "Panic", id: "binary_sensor.helloliam_alarm_zone_001_panic", bypass: "binary_sensor.helloliam_alarm_zone_001_bypass_panic", bypassBtn: "button.helloliam_alarm_zone_001_bypass_panic", unbypassBtn: "button.helloliam_alarm_zone_001_unbypass_panic" },
  { n: "002", label: "PIR · Guest Room", id: "binary_sensor.helloliam_alarm_zone_002_pir_guest_room", bypass: "binary_sensor.helloliam_alarm_zone_002_bypass_pir_guest_room", bypassBtn: "button.helloliam_alarm_zone_002_bypass_pir_guest_room", unbypassBtn: "button.helloliam_alarm_zone_002_unbypass_pir_guest_room" },
  { n: "003", label: "PIR · Kids Room", id: "binary_sensor.helloliam_alarm_zone_003_pir_kids_room", bypass: "binary_sensor.helloliam_alarm_zone_003_bypass_pir_kids_room", bypassBtn: "button.helloliam_alarm_zone_003_bypass_pir_kids_room", unbypassBtn: "button.helloliam_alarm_zone_003_unbypass_pir_kids_room" },
  { n: "004", label: "REMOTE P1 P2", id: "binary_sensor.helloliam_alarm_zone_004_remote_p1_p2", bypass: "binary_sensor.helloliam_alarm_zone_004_bypass_remote_p1_p2", bypassBtn: "button.helloliam_alarm_zone_004_bypass_remote_p1_p2", unbypassBtn: "button.helloliam_alarm_zone_004_unbypass_remote_p1_p2" },
  { n: "005", label: "REMOTE P1", id: "binary_sensor.helloliam_alarm_zone_005_remote_p1", bypass: "binary_sensor.helloliam_alarm_zone_005_bypass_remote_p1", bypassBtn: "button.helloliam_alarm_zone_005_bypass_remote_p1", unbypassBtn: "button.helloliam_alarm_zone_005_unbypass_remote_p1" },
  { n: "006", label: "Beam · Gate To Back", id: "binary_sensor.helloliam_alarm_zone_006_beam_gate_to_back", bypass: "binary_sensor.helloliam_alarm_zone_006_bypass_beam_gate_to_back", bypassBtn: "button.helloliam_alarm_zone_006_bypass_beam_gate_to_back", unbypassBtn: "button.helloliam_alarm_zone_006_unbypass_beam_gate_to_back" },
  { n: "007", label: "PIR · TV Room", id: "binary_sensor.helloliam_alarm_zone_007_pir_tv_room", bypass: "binary_sensor.helloliam_alarm_zone_007_bypass_pir_tv_room", bypassBtn: "button.helloliam_alarm_zone_007_bypass_pir_tv_room", unbypassBtn: "button.helloliam_alarm_zone_007_unbypass_pir_tv_room" },
  { n: "008", label: "PIR · Lounge", id: "binary_sensor.helloliam_alarm_zone_008_pir_lounge", bypass: "binary_sensor.helloliam_alarm_zone_008_bypass_pir_lounge", bypassBtn: "button.helloliam_alarm_zone_008_bypass_pir_lounge", unbypassBtn: "button.helloliam_alarm_zone_008_unbypass_pir_lounge" },
  { n: "009", label: "PIR · Kitchen", id: "binary_sensor.helloliam_alarm_zone_009_pir_kitchen", bypass: "binary_sensor.helloliam_alarm_zone_009_bypass_pir_kitchen", bypassBtn: "button.helloliam_alarm_zone_009_bypass_pir_kitchen", unbypassBtn: "button.helloliam_alarm_zone_009_unbypass_pir_kitchen" },
  { n: "010", label: "PIR · Garage", id: "binary_sensor.helloliam_alarm_zone_010_pir_garage", bypass: "binary_sensor.helloliam_alarm_zone_010_bypass_pir_garage", bypassBtn: "button.helloliam_alarm_zone_010_bypass_pir_garage", unbypassBtn: "button.helloliam_alarm_zone_010_unbypass_pir_garage" },
  { n: "011", label: "Beam · Back Gas", id: "binary_sensor.helloliam_alarm_zone_011_beam_back_gas", bypass: "binary_sensor.helloliam_alarm_zone_011_bypass_beam_back_gas", bypassBtn: "button.helloliam_alarm_zone_011_bypass_beam_back_gas", unbypassBtn: "button.helloliam_alarm_zone_011_unbypass_beam_back_gas" },
  { n: "012", label: "Beam · Store Room", id: "binary_sensor.helloliam_alarm_zone_012_beam_store_room", bypass: "binary_sensor.helloliam_alarm_zone_012_bypass_beam_store_room", bypassBtn: "button.helloliam_alarm_zone_012_bypass_beam_store_room", unbypassBtn: "button.helloliam_alarm_zone_012_unbypass_beam_store_room" },
  { n: "013", label: "Front Door", id: "binary_sensor.helloliam_alarm_zone_013_front_door", bypass: "binary_sensor.helloliam_alarm_zone_013_bypass_front_door", bypassBtn: "button.helloliam_alarm_zone_013_bypass_front_door", unbypassBtn: "button.helloliam_alarm_zone_013_unbypass_front_door" },
  { n: "014", label: "PIR · Front Door", id: "binary_sensor.helloliam_alarm_zone_014_pir_front_door", bypass: "binary_sensor.helloliam_alarm_zone_014_bypass_pir_front_door", bypassBtn: "button.helloliam_alarm_zone_014_bypass_pir_front_door", unbypassBtn: "button.helloliam_alarm_zone_014_unbypass_pir_front_door" },
  { n: "015", label: "Beam · Driveway", id: "binary_sensor.helloliam_alarm_zone_015_beam_driveway", bypass: "binary_sensor.helloliam_alarm_zone_015_bypass_beam_driveway", bypassBtn: "button.helloliam_alarm_zone_015_bypass_beam_driveway", unbypassBtn: "button.helloliam_alarm_zone_015_unbypass_beam_driveway" },
  { n: "016", label: "Lounge Windows", id: "binary_sensor.helloliam_alarm_zone_016_lounge_windows", bypass: "binary_sensor.helloliam_alarm_zone_016_bypass_lounge_windows", bypassBtn: "button.helloliam_alarm_zone_016_bypass_lounge_windows", unbypassBtn: "button.helloliam_alarm_zone_016_unbypass_lounge_windows" },
  { n: "017", label: "Beam · Bedroom Windows", id: "binary_sensor.helloliam_alarm_zone_017_beam_bedroom_windows", bypass: "binary_sensor.helloliam_alarm_zone_017_bypass_beam_bedroom_windows", bypassBtn: "button.helloliam_alarm_zone_017_bypass_beam_bedroom_windows", unbypassBtn: "button.helloliam_alarm_zone_017_unbypass_beam_bedroom_windows" },
  { n: "018", label: "Beam · Pool", id: "binary_sensor.helloliam_alarm_zone_018_beam_pool", bypass: "binary_sensor.helloliam_alarm_zone_018_bypass_beam_pool", bypassBtn: "button.helloliam_alarm_zone_018_bypass_beam_pool", unbypassBtn: "button.helloliam_alarm_zone_018_unbypass_beam_pool" },
  { n: "019", label: "PIR · Roof", id: "binary_sensor.helloliam_alarm_zone_019_pir_roof", bypass: "binary_sensor.helloliam_alarm_zone_019_bypass_pir_roof", bypassBtn: "button.helloliam_alarm_zone_019_bypass_pir_roof", unbypassBtn: "button.helloliam_alarm_zone_019_unbypass_pir_roof" },
  { n: "020", label: "Door · Kitchen", id: "binary_sensor.helloliam_alarm_zone_020_door_kitchen", bypass: "binary_sensor.helloliam_alarm_zone_020_bypass_door_kitchen", bypassBtn: "button.helloliam_alarm_zone_020_bypass_door_kitchen", unbypassBtn: "button.helloliam_alarm_zone_020_unbypass_door_kitchen" },
  { n: "021", label: "PIR · Passage", id: "binary_sensor.helloliam_alarm_zone_021_pir_passage", bypass: "binary_sensor.helloliam_alarm_zone_021_bypass_pir_passage", bypassBtn: "button.helloliam_alarm_zone_021_bypass_pir_passage", unbypassBtn: "button.helloliam_alarm_zone_021_unbypass_pir_passage" },
  { n: "022", label: "Beam · Back Garden", id: "binary_sensor.helloliam_alarm_zone_022_beam_back_garden", bypass: "binary_sensor.helloliam_alarm_zone_022_bypass_beam_back_garden", bypassBtn: "button.helloliam_alarm_zone_022_bypass_beam_back_garden", unbypassBtn: "button.helloliam_alarm_zone_022_unbypass_beam_back_garden" },
  { n: "023", label: "Beam · Patio", id: "binary_sensor.helloliam_alarm_zone_023_beam_patio", bypass: "binary_sensor.helloliam_alarm_zone_023_bypass_beam_patio", bypassBtn: "button.helloliam_alarm_zone_023_bypass_beam_patio", unbypassBtn: "button.helloliam_alarm_zone_023_unbypass_beam_patio" },
  { n: "024", label: "Door · Lounge", id: "binary_sensor.helloliam_alarm_zone_024_door_lounge", bypass: "binary_sensor.helloliam_alarm_zone_024_bypass_door_lounge", bypassBtn: "button.helloliam_alarm_zone_024_bypass_door_lounge", unbypassBtn: "button.helloliam_alarm_zone_024_unbypass_door_lounge" },
  { n: "025", label: "PIR · Main Room", id: "binary_sensor.helloliam_alarm_zone_025_pir_main_room", bypass: "binary_sensor.helloliam_alarm_zone_025_bypass_pir_main_room", bypassBtn: "button.helloliam_alarm_zone_025_bypass_pir_main_room", unbypassBtn: "button.helloliam_alarm_zone_025_unbypass_pir_main_room" },
  { n: "026", label: "Zone 26", id: "binary_sensor.helloliam_alarm_zone_026_zone_26", bypass: "binary_sensor.helloliam_alarm_zone_026_bypass_zone_26", bypassBtn: "button.helloliam_alarm_zone_026_bypass_zone_26", unbypassBtn: "button.helloliam_alarm_zone_026_unbypass_zone_26" },
  { n: "027", label: "Zone 27", id: "binary_sensor.helloliam_alarm_zone_027_zone_27", bypass: "binary_sensor.helloliam_alarm_zone_027_bypass_zone_27", bypassBtn: "button.helloliam_alarm_zone_027_bypass_zone_27", unbypassBtn: "button.helloliam_alarm_zone_027_unbypass_zone_27" },
  { n: "028", label: "Zone 28", id: "binary_sensor.helloliam_alarm_zone_028_zone_28", bypass: "binary_sensor.helloliam_alarm_zone_028_bypass_zone_28", bypassBtn: "button.helloliam_alarm_zone_028_bypass_zone_28", unbypassBtn: "button.helloliam_alarm_zone_028_unbypass_zone_28" },
  { n: "029", label: "Zone 29", id: "binary_sensor.helloliam_alarm_zone_029_zone_29", bypass: "binary_sensor.helloliam_alarm_zone_029_bypass_zone_29", bypassBtn: "button.helloliam_alarm_zone_029_bypass_zone_29", unbypassBtn: "button.helloliam_alarm_zone_029_unbypass_zone_29" },
  { n: "030", label: "Beam · Garage", id: "binary_sensor.helloliam_alarm_zone_030_beam_garage", bypass: "binary_sensor.helloliam_alarm_zone_030_bypass_beam_garage", bypassBtn: "button.helloliam_alarm_zone_030_bypass_beam_garage", unbypassBtn: "button.helloliam_alarm_zone_030_unbypass_beam_garage" },
  { n: "031", label: "Zone 31", id: "binary_sensor.helloliam_alarm_zone_031_zone_31", bypass: "binary_sensor.helloliam_alarm_zone_031_bypass_zone_31", bypassBtn: "button.helloliam_alarm_zone_031_bypass_zone_31", unbypassBtn: "button.helloliam_alarm_zone_031_unbypass_zone_31" },
];

export const DECO_NODES: { id: string; label: string }[] = [
  { id: "device_tracker.kitchen_deco", label: "Kitchen" },
  { id: "device_tracker.main_living_room_deco", label: "Living Room" },
  { id: "device_tracker.study_deco", label: "Study" },
];

export const INK: { id: string; label: string; color: string }[] = [
  { id: "sensor.brother_dcp_t720dw_bk", label: "Black", color: "#e8edf4" },
  { id: "sensor.brother_dcp_t720dw_c", label: "Cyan", color: "#22d3ee" },
  { id: "sensor.brother_dcp_t720dw_m", label: "Magenta", color: "#e879f9" },
  { id: "sensor.brother_dcp_t720dw_y", label: "Yellow", color: "#facc15" },
];
