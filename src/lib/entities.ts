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
  lastPlate: "sensor.main_gate_ai_last_recognized_plate",
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
  printer: "sensor.brother_dcp_t720dw",
  inkBk: "sensor.brother_dcp_t720dw_bk",
  inkC: "sensor.brother_dcp_t720dw_c",
  inkM: "sensor.brother_dcp_t720dw_m",
  inkY: "sensor.brother_dcp_t720dw_y",

  // Pumps
  waterPump: "switch.water_pump",
  poolPump: "switch.pool_pump",
  boreholePump: "switch.borehole_pump",

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
  ouraSleepHRV: "sensor.oura_average_hrv",
  ouraCurrentHR: "sensor.oura_current_heart_rate",
  ouraRestingHR: "sensor.oura_lowest_sleep_heart_rate",
  ouraSteps: "sensor.oura_steps",
  ouraActiveCal: "sensor.oura_active_calories",
  ouraTotalCal: "sensor.oura_total_calories",
  ouraTargetCal: "sensor.oura_target_calories",
  ouraLowActivity: "sensor.oura_low_activity_time",
  ouraRingBatt: "sensor.oura_ring_battery_level",
  ouraBedStart: "sensor.oura_bedtime_start",
  ouraBedEnd: "sensor.oura_bedtime_end",
  ouraTempDev: "sensor.oura_temperature_deviation",
} as const;

export type SceneDef = { id: string; label: string; icon: string };
export const SCENES: SceneDef[] = [
  { id: "script.quick_goodnight_scene", label: "Goodnight", icon: "🌙" },
  { id: "script.movie_mode", label: "Movie", icon: "🎬" },
  { id: "script.quick_away_mode", label: "Away", icon: "🚪" },
  { id: "script.quick_good_morning_scene", label: "Morning", icon: "☀️" },
];

// Camera feeds (live streams need HLS/WebRTC wiring; shown as labelled tiles for now).
export const CAMERAS: { id: string; label: string; sub: string }[] = [
  { id: "camera.main_gate", label: "Main Gate", sub: "ANPR" },
  { id: "camera.driveway", label: "Driveway", sub: "Frigate" },
  { id: "camera.gate_outside", label: "Gate Outside", sub: "street" },
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

// Irrigation zone labels (from the input_select options).
export const IRRIGATION_ZONES = [
  "Front Lawn", "Back Garden", "Veggie Patch", "Flower Beds", "Driveway Strip", "Rose Garden",
];

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

export type LightDef = { id: string; label: string; icon: string };

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

// All light-ish entities we can safely blanket "turn off".
export const ALL_LIGHTS = [
  ...INDOOR_LIGHTS.map((l) => l.id),
  ...OUTDOOR_LIGHTS.map((l) => l.id),
];

export type Appliance = { sw: string; power: string; label: string; icon: string };

export const APPLIANCES: Appliance[] = [
  { sw: "switch.dishwasher", power: "sensor.dishwasher_power", label: "Dishwasher", icon: "🍽️" },
  { sw: "switch.washing_machine", power: "sensor.washing_machine_energy_power", label: "Washer", icon: "🧺" },
  { sw: "switch.tumble_dryer", power: "sensor.tumble_dryer_energy_power", label: "Dryer", icon: "🌀" },
  { sw: "switch.kettle", power: "sensor.kettle_power", label: "Kettle", icon: "☕" },
  { sw: "switch.microwave", power: "sensor.microwave_current_consumption", label: "Microwave", icon: "🍲" },
  { sw: "switch.kitchen_air_fryer", power: "sensor.kitchen_air_fryer_power", label: "Air Fryer", icon: "🍟" },
  { sw: "switch.nespresso", power: "sensor.nespresso_current_consumption", label: "Nespresso", icon: "☕" },
  { sw: "switch.work_pc", power: "sensor.work_pc_current_consumption", label: "Work PC", icon: "💻" },
  { sw: "switch.study_heater", power: "sensor.study_heater_current_consumption", label: "Study Heater", icon: "🔥" },
];

export type ZoneDef = { id: string; label: string };

// Security zones worth surfacing (beams + key doors/PIRs).
export const ZONES: ZoneDef[] = [
  { id: "binary_sensor.helloliam_alarm_zone_013_front_door", label: "Front Door" },
  { id: "binary_sensor.helloliam_alarm_zone_020_door_kitchen", label: "Kitchen Door" },
  { id: "binary_sensor.helloliam_alarm_zone_024_door_lounge", label: "Lounge Door" },
  { id: "binary_sensor.helloliam_alarm_zone_016_lounge_windows", label: "Lounge Windows" },
  { id: "binary_sensor.helloliam_alarm_zone_015_beam_driveway", label: "Driveway Beam" },
  { id: "binary_sensor.helloliam_alarm_zone_018_beam_pool", label: "Pool Beam" },
  { id: "binary_sensor.helloliam_alarm_zone_022_beam_back_garden", label: "Back Garden Beam" },
  { id: "binary_sensor.helloliam_alarm_zone_023_beam_patio", label: "Patio Beam" },
  { id: "binary_sensor.helloliam_alarm_zone_030_beam_garage", label: "Garage Beam" },
  { id: "binary_sensor.helloliam_alarm_zone_006_beam_gate_to_back", label: "Gate→Back Beam" },
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
