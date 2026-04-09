/**
 * Generate and upload SVG icons for all subcategories.
 * Style matches existing division/category icons: 48x48, stroke #e4e4e7, stroke-width 2.
 * Run: node scripts/generate-subcategory-icons.js
 */

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  "https://yxyizbnfjrwrnmwhkvme.supabase.co",
  "sb_publishable_71Q6P6mZXtddY6wNMRN41A_7DJyShha"
);

const BUCKET = "media";
const FOLDER = "subcategories";

// SVG wrapper
const svg = (inner) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="#e4e4e7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;

// ── Icon templates (48x48 viewbox, stroke-based) ──
const ICONS = {
  // --- PHONES / TABLETS ---
  smartphone: svg(`<rect x="14" y="4" width="20" height="40" rx="3"/><line x1="21" y1="38" x2="27" y2="38" stroke-width="1.5"/><line x1="22" y1="8" x2="26" y2="8" stroke-width="1.5"/>`),
  tablet: svg(`<rect x="8" y="6" width="32" height="36" rx="3"/><circle cx="24" cy="38" r="1.5" fill="#e4e4e7"/>`),
  laptop: svg(`<path d="M10 10h28v22H10z" /><path d="M6 32h36l-3 6H9z"/>`),
  desktop: svg(`<rect x="8" y="6" width="32" height="24" rx="2"/><line x1="24" y1="30" x2="24" y2="36"/><line x1="16" y1="36" x2="32" y2="36"/>`),

  // --- WATCHES / TRACKERS ---
  watch: svg(`<circle cx="24" cy="24" r="10"/><path d="M24 14V6M24 42v-8"/><rect x="18" y="4" width="12" height="4" rx="1"/><rect x="18" y="40" width="12" height="4" rx="1"/><line x1="24" y1="20" x2="24" y2="24"/><line x1="24" y1="24" x2="28" y2="26"/>`),
  fitness: svg(`<path d="M8 24c4-8 8-12 12-12s4 4 8 12-4 12-8 12-8-4-12-12z"/><polyline points="4,24 12,24 16,16 20,32 24,20 28,28 32,24 44,24"/>`),

  // --- AUDIO ---
  headphone: svg(`<path d="M8 28v-4a16 16 0 0 1 32 0v4"/><rect x="6" y="28" width="6" height="12" rx="2"/><rect x="36" y="28" width="6" height="12" rx="2"/>`),
  earphone: svg(`<circle cx="16" cy="30" r="6"/><circle cx="32" cy="30" r="6"/><path d="M16 24c0-8 8-14 8-14s8 6 8 14"/>`),
  speaker: svg(`<rect x="12" y="6" width="24" height="36" rx="4"/><circle cx="24" cy="28" r="8"/><circle cx="24" cy="28" r="3"/><circle cx="24" cy="14" r="3"/>`),
  soundbar: svg(`<rect x="4" y="18" width="40" height="12" rx="4"/><circle cx="14" cy="24" r="3"/><circle cx="24" cy="24" r="3"/><circle cx="34" cy="24" r="3"/>`),

  // --- CAMERAS ---
  camera: svg(`<rect x="6" y="14" width="36" height="24" rx="3"/><circle cx="24" cy="26" r="7"/><circle cx="24" cy="26" r="3"/><path d="M18 14l2-4h8l2 4"/>`),
  action_camera: svg(`<rect x="10" y="10" width="28" height="28" rx="4"/><circle cx="24" cy="24" r="6"/><circle cx="24" cy="24" r="2"/><circle cx="34" cy="14" r="1.5" fill="#e4e4e7"/>`),

  // --- TVs ---
  tv: svg(`<rect x="6" y="6" width="36" height="28" rx="2"/><line x1="18" y1="38" x2="30" y2="38"/><line x1="24" y1="34" x2="24" y2="38"/>`),

  // --- GAMING ---
  console: svg(`<rect x="6" y="14" width="36" height="20" rx="4"/><circle cx="16" cy="24" r="3"/><circle cx="32" cy="22" r="1.5" fill="#e4e4e7"/><circle cx="36" cy="26" r="1.5" fill="#e4e4e7"/><circle cx="32" cy="30" r="1.5" fill="#e4e4e7"/><circle cx="28" cy="26" r="1.5" fill="#e4e4e7"/>`),
  handheld: svg(`<rect x="4" y="12" width="40" height="24" rx="6"/><rect x="14" y="16" width="20" height="16" rx="1"/><circle cx="10" cy="24" r="2"/><circle cx="38" cy="24" r="2"/>`),

  // --- DRONES ---
  drone: svg(`<circle cx="24" cy="24" r="4"/><line x1="24" y1="20" x2="12" y2="12"/><line x1="24" y1="20" x2="36" y2="12"/><line x1="24" y1="28" x2="12" y2="36"/><line x1="24" y1="28" x2="36" y2="36"/><circle cx="12" cy="12" r="4"/><circle cx="36" cy="12" r="4"/><circle cx="12" cy="36" r="4"/><circle cx="36" cy="36" r="4"/>`),

  // --- STORAGE ---
  hard_drive: svg(`<rect x="8" y="14" width="32" height="20" rx="3"/><circle cx="34" cy="28" r="2"/><line x1="12" y1="28" x2="22" y2="28"/>`),
  usb: svg(`<rect x="18" y="4" width="12" height="24" rx="2"/><line x1="22" y1="12" x2="22" y2="16"/><line x1="26" y1="10" x2="26" y2="16"/><path d="M16 28h16v8a4 4 0 0 1-4 4h-8a4 4 0 0 1-4-4z"/>`),
  memory_card: svg(`<path d="M12 6h18l6 6v28a2 2 0 0 1-2 2H14a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z"/><line x1="20" y1="28" x2="20" y2="36"/><line x1="24" y1="26" x2="24" y2="36"/><line x1="28" y1="28" x2="28" y2="36"/>`),

  // --- CHARGERS / CABLES ---
  charger: svg(`<path d="M20 4v8h8V4"/><rect x="16" y="12" width="16" height="10" rx="2"/><line x1="24" y1="22" x2="24" y2="32"/><path d="M20 32h8v6a4 4 0 0 1-4 4 4 4 0 0 1-4-4z"/>`),
  cable: svg(`<path d="M16 8h-4a4 4 0 0 0-4 4v24a4 4 0 0 0 4 4h4"/><path d="M32 8h4a4 4 0 0 1 4 4v24a4 4 0 0 1-4 4h-4"/><line x1="16" y1="16" x2="32" y2="16"/><line x1="16" y1="24" x2="32" y2="24"/><line x1="16" y1="32" x2="32" y2="32"/>`),
  wireless_charger: svg(`<rect x="10" y="28" width="28" height="8" rx="4"/><path d="M20 24a6 6 0 0 1 8 0"/><path d="M16 20a12 12 0 0 1 16 0"/><path d="M12 16a18 18 0 0 1 24 0"/>`),
  power_bank: svg(`<rect x="12" y="8" width="24" height="32" rx="4"/><path d="M22 20h4v-4l4 8h-4v4l-4-8z" fill="#e4e4e7" stroke="none"/>`),

  // --- PRINTER ---
  printer: svg(`<rect x="8" y="18" width="32" height="16" rx="2"/><path d="M14 18V8h20v10"/><path d="M14 30v10h20V30"/><line x1="14" y1="36" x2="26" y2="36"/>`),

  // --- VR ---
  vr: svg(`<rect x="6" y="14" width="36" height="20" rx="6"/><circle cx="18" cy="24" r="5"/><circle cx="30" cy="24" r="5"/><path d="M23 24h2"/>`),

  // --- ACCESSORIES ---
  accessory: svg(`<circle cx="24" cy="18" r="8"/><path d="M12 38c0-6 5-12 12-12s12 6 12 12"/>`),

  // --- VEHICLES ---
  car: svg(`<path d="M8 28h32"/><path d="M12 28l2-8h20l2 8"/><rect x="6" y="28" width="36" height="8" rx="2"/><circle cx="14" cy="36" r="3"/><circle cx="34" cy="36" r="3"/>`),
  motorcycle: svg(`<circle cx="12" cy="32" r="6"/><circle cx="36" cy="32" r="6"/><path d="M18 32l6-14h6l6 14"/><path d="M24 18l-4 4"/>`),
  scooter: svg(`<circle cx="12" cy="36" r="5"/><circle cx="36" cy="36" r="5"/><path d="M12 31V16h4l8 8h12v7"/><line x1="16" y1="16" x2="16" y2="8"/><line x1="14" y1="8" x2="20" y2="8"/>`),
  bicycle: svg(`<circle cx="12" cy="32" r="7"/><circle cx="36" cy="32" r="7"/><path d="M12 32l12-16 12 16"/><path d="M24 16l-6 16"/><line x1="18" y1="32" x2="30" y2="32"/>`),
  truck: svg(`<rect x="4" y="16" width="26" height="18" rx="2"/><path d="M30 22h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H30"/><circle cx="14" cy="36" r="3"/><circle cx="36" cy="36" r="3"/>`),

  // --- EV CHARGING ---
  ev_charger: svg(`<rect x="14" y="6" width="20" height="30" rx="3"/><path d="M22 20h4v-4l4 8h-4v4l-4-8z" fill="#e4e4e7" stroke="none"/><line x1="24" y1="36" x2="24" y2="42"/><line x1="18" y1="42" x2="30" y2="42"/>`),

  // --- SOLAR / ENERGY ---
  solar: svg(`<rect x="6" y="8" width="36" height="24" rx="1"/><line x1="6" y1="16" x2="42" y2="16"/><line x1="6" y1="24" x2="42" y2="24"/><line x1="18" y1="8" x2="18" y2="32"/><line x1="30" y1="8" x2="30" y2="32"/><line x1="24" y1="32" x2="24" y2="40"/><line x1="18" y1="40" x2="30" y2="40"/>`),
  battery: svg(`<rect x="10" y="12" width="28" height="24" rx="3"/><rect x="18" y="8" width="12" height="4"/><rect x="14" y="18" width="8" height="12" rx="1" fill="#e4e4e7" stroke="none" opacity="0.3"/><rect x="26" y="18" width="8" height="12" rx="1" fill="#e4e4e7" stroke="none" opacity="0.3"/>`),
  inverter: svg(`<rect x="8" y="10" width="32" height="28" rx="3"/><path d="M18 24c2-4 4-4 6 0s4 4 6 0"/><circle cx="14" cy="14" r="1.5" fill="#e4e4e7"/><circle cx="34" cy="14" r="1.5" fill="#e4e4e7"/>`),
  generator: svg(`<rect x="10" y="12" width="28" height="24" rx="3"/><circle cx="24" cy="24" r="6"/><path d="M22 22l4 4M22 26l4-4"/>`),
  ups: svg(`<rect x="12" y="8" width="24" height="32" rx="3"/><path d="M22 20h4v-4l4 8h-4v4l-4-8z" fill="#e4e4e7" stroke="none"/><line x1="18" y1="36" x2="30" y2="36"/>`),
  panel: svg(`<rect x="8" y="10" width="32" height="28" rx="2"/><line x1="8" y1="20" x2="40" y2="20"/><line x1="8" y1="30" x2="40" y2="30"/><line x1="20" y1="10" x2="20" y2="38"/><line x1="32" y1="10" x2="32" y2="38"/>`),
  meter: svg(`<rect x="12" y="8" width="24" height="32" rx="3"/><path d="M18 20h12v8H18z"/><circle cx="18" cy="34" r="1.5" fill="#e4e4e7"/><circle cx="24" cy="34" r="1.5" fill="#e4e4e7"/><circle cx="30" cy="34" r="1.5" fill="#e4e4e7"/>`),
  transformer: svg(`<circle cx="18" cy="24" r="8"/><circle cx="30" cy="24" r="8"/><line x1="10" y1="24" x2="4" y2="24"/><line x1="44" y1="24" x2="38" y2="24"/>`),
  switchgear: svg(`<rect x="10" y="8" width="28" height="32" rx="2"/><rect x="16" y="14" width="16" height="8" rx="1"/><circle cx="20" cy="30" r="2"/><circle cx="28" cy="30" r="2"/><line x1="20" y1="32" x2="20" y2="36"/><line x1="28" y1="32" x2="28" y2="36"/>`),

  // --- SEWING MACHINES ---
  sewing: svg(`<path d="M10 36h28"/><rect x="14" y="20" width="20" height="16" rx="2"/><path d="M24 8v12"/><path d="M18 8h12a2 2 0 0 1 2 2v4H16v-4a2 2 0 0 1 2-2z"/><line x1="24" y1="32" x2="24" y2="40"/>`),
  overlock: svg(`<rect x="10" y="14" width="28" height="24" rx="3"/><path d="M16 8v6"/><path d="M22 8v6"/><path d="M28 8v6"/><line x1="10" y1="30" x2="38" y2="30"/>`),
  embroidery: svg(`<rect x="8" y="8" width="32" height="32" rx="3"/><circle cx="24" cy="24" r="8"/><path d="M20 20l8 8M20 28l8-8"/><line x1="24" y1="8" x2="24" y2="16"/>`),

  // --- CUTTING ---
  cutting: svg(`<path d="M8 40L24 8l16 32"/><line x1="14" y1="28" x2="34" y2="28"/>`),
  scissors: svg(`<circle cx="18" cy="34" r="4"/><circle cx="30" cy="34" r="4"/><path d="M18 30L30 10"/><path d="M30 30L18 10"/>`),
  knife: svg(`<path d="M36 8L12 32"/><path d="M12 32l-4 4 8 2-4-6z"/><line x1="28" y1="16" x2="34" y2="10"/>`),

  // --- PRESSING / FINISHING ---
  iron: svg(`<path d="M12 20h24l-6 16H12z"/><rect x="16" y="12" width="16" height="8" rx="2"/>`),
  press: svg(`<rect x="8" y="26" width="32" height="10" rx="2"/><rect x="10" y="12" width="28" height="10" rx="2"/><line x1="14" y1="22" x2="14" y2="26"/><line x1="34" y1="22" x2="34" y2="26"/>`),
  boiler: svg(`<rect x="14" y="6" width="20" height="30" rx="4"/><circle cx="24" cy="20" r="6"/><path d="M20 36h8v6H20z"/>`),

  // --- FABRIC ---
  fabric: svg(`<rect x="8" y="12" width="32" height="24" rx="2"/><path d="M8 20h32"/><path d="M8 28h32"/><path d="M20 12v24"/><path d="M32 12v24"/>`),
  roll: svg(`<ellipse cx="24" cy="12" rx="14" ry="6"/><path d="M10 12v24c0 3.3 6.3 6 14 6s14-2.7 14-6V12"/><ellipse cx="24" cy="36" rx="14" ry="6"/>`),

  // --- PACKAGING ---
  box: svg(`<path d="M6 16l18-8 18 8v20l-18 8-18-8z"/><path d="M6 16l18 8 18-8"/><line x1="24" y1="24" x2="24" y2="44"/>`),
  sealing: svg(`<rect x="6" y="18" width="36" height="16" rx="2"/><line x1="6" y1="26" x2="42" y2="26"/><path d="M16 18V10h16v8"/><path d="M16 34v8h16v-8"/>`),

  // --- ROBOTS / AUTOMATION ---
  robot: svg(`<rect x="12" y="12" width="24" height="24" rx="4"/><circle cx="20" cy="22" r="3"/><circle cx="28" cy="22" r="3"/><line x1="20" y1="30" x2="28" y2="30"/><line x1="24" y1="8" x2="24" y2="12"/><circle cx="24" cy="6" r="2"/>`),
  robotic_arm: svg(`<circle cx="12" cy="36" r="4"/><line x1="12" y1="32" x2="20" y2="18"/><line x1="20" y1="18" x2="32" y2="12"/><line x1="32" y1="12" x2="38" y2="8"/><circle cx="20" cy="18" r="2"/><circle cx="32" cy="12" r="2"/>`),

  // --- CNC / INDUSTRIAL ---
  cnc: svg(`<rect x="6" y="6" width="36" height="36" rx="3"/><rect x="14" y="14" width="20" height="20" rx="1"/><line x1="24" y1="6" x2="24" y2="14"/><circle cx="24" cy="10" r="2"/>`),
  machine: svg(`<rect x="6" y="12" width="36" height="28" rx="3"/><rect x="12" y="6" width="24" height="6" rx="1"/><circle cx="24" cy="28" r="6"/><circle cx="24" cy="28" r="2"/>`),
  conveyor: svg(`<circle cx="10" cy="32" r="5"/><circle cx="38" cy="32" r="5"/><line x1="15" y1="32" x2="33" y2="32"/><line x1="10" y1="27" x2="38" y2="27"/><rect x="16" y="20" width="16" height="7" rx="1"/>`),

  // --- MEDICAL ---
  hospital_bed: svg(`<rect x="8" y="18" width="32" height="12" rx="2"/><path d="M14 18v-6h12v6"/><circle cx="12" cy="34" r="3"/><circle cx="36" cy="34" r="3"/><line x1="8" y1="30" x2="8" y2="34"/><line x1="40" y1="30" x2="40" y2="34"/>`),
  stethoscope: svg(`<path d="M16 10v8a8 8 0 0 0 16 0v-8"/><circle cx="16" cy="8" r="2"/><circle cx="32" cy="8" r="2"/><line x1="36" y1="22" x2="36" y2="28"/><circle cx="36" cy="30" r="3"/>`),
  syringe: svg(`<rect x="18" y="8" width="12" height="24" rx="1"/><line x1="24" y1="32" x2="24" y2="40"/><line x1="22" y1="40" x2="26" y2="40"/><line x1="24" y1="4" x2="24" y2="8"/><line x1="18" y1="16" x2="30" y2="16"/><line x1="18" y1="22" x2="30" y2="22"/>`),
  xray: svg(`<rect x="8" y="6" width="32" height="36" rx="3"/><circle cx="24" cy="20" r="8"/><rect x="14" y="32" width="20" height="4" rx="1"/>`),
  wheelchair: svg(`<circle cx="14" cy="36" r="6"/><circle cx="34" cy="36" r="6"/><path d="M14 30V16h8"/><path d="M22 24h10l4 12"/>`),
  mask: svg(`<path d="M10 18c0-4 6-8 14-8s14 4 14 8v6c0 6-6 12-14 12S10 30 10 24z"/><line x1="10" y1="18" x2="4" y2="16"/><line x1="38" y1="18" x2="44" y2="16"/><line x1="16" y1="24" x2="32" y2="24"/>`),
  microscope: svg(`<circle cx="24" cy="12" r="6"/><line x1="24" y1="18" x2="24" y2="34"/><line x1="16" y1="34" x2="32" y2="34"/><path d="M18 28h12"/><line x1="24" y1="34" x2="24" y2="40"/><line x1="14" y1="40" x2="34" y2="40"/>`),
  monitor: svg(`<rect x="10" y="10" width="28" height="20" rx="2"/><path d="M16 16h16"/><path d="M16 22h10"/><line x1="24" y1="30" x2="24" y2="36"/><line x1="16" y1="36" x2="32" y2="36"/>`),
  oxygen: svg(`<rect x="16" y="4" width="16" height="32" rx="4"/><circle cx="24" cy="18" r="4"/><path d="M24 36v6"/><path d="M16 42h16"/>`),
  surgical_tool: svg(`<line x1="24" y1="6" x2="24" y2="32"/><path d="M18 6h12"/><path d="M20 32c0 4 2 8 4 8s4-4 4-8"/>`),
  ecg: svg(`<rect x="8" y="10" width="32" height="28" rx="3"/><polyline points="12,26 18,26 20,18 24,34 28,22 30,26 36,26"/>`),
  infusion: svg(`<rect x="18" y="4" width="12" height="16" rx="2"/><line x1="24" y1="20" x2="24" y2="32"/><line x1="20" y1="28" x2="28" y2="28"/><path d="M22 32h4v6l-2 4-2-4z"/>`),
  glove: svg(`<path d="M16 38V22l-4-8v-4h4v8l2 4h12l2-4V10h4v4l-4 8v16z"/>`),
  centrifuge: svg(`<circle cx="24" cy="24" r="14"/><circle cx="24" cy="24" r="4"/><line x1="24" y1="20" x2="24" y2="10"/><line x1="20" y1="24" x2="10" y2="24"/><line x1="28" y1="24" x2="38" y2="24"/>`),

  // --- SMART HOME ---
  smart_home: svg(`<path d="M6 22L24 8l18 14"/><path d="M10 20v18a2 2 0 0 0 2 2h24a2 2 0 0 0 2-2V20"/><rect x="20" y="28" width="8" height="12"/>`),
  smart_lock: svg(`<rect x="14" y="20" width="20" height="20" rx="3"/><path d="M18 20v-6a6 6 0 0 1 12 0v6"/><circle cx="24" cy="30" r="3"/><line x1="24" y1="33" x2="24" y2="36"/>`),
  sensor: svg(`<circle cx="24" cy="24" r="4"/><path d="M18 18a8 8 0 0 1 12 0"/><path d="M14 14a14 14 0 0 1 20 0"/><path d="M18 30a8 8 0 0 0 12 0"/><path d="M14 34a14 14 0 0 0 20 0"/>`),
  thermostat: svg(`<circle cx="24" cy="24" r="14"/><path d="M24 14v10l6 4"/><circle cx="24" cy="24" r="2" fill="#e4e4e7"/>`),
  camera_security: svg(`<rect x="6" y="16" width="28" height="16" rx="3"/><circle cx="20" cy="24" r="5"/><path d="M34 20l8-4v16l-8-4"/>`),
  doorbell: svg(`<rect x="16" y="6" width="16" height="36" rx="4"/><circle cx="24" cy="20" r="6"/><circle cx="24" cy="20" r="2"/><rect x="20" y="32" width="8" height="4" rx="1"/>`),
  switch: svg(`<rect x="14" y="10" width="20" height="28" rx="4"/><circle cx="24" cy="22" r="5"/><line x1="24" y1="17" x2="24" y2="22"/>`),

  // --- HOME APPLIANCE ---
  fridge: svg(`<rect x="12" y="4" width="24" height="40" rx="3"/><line x1="12" y1="20" x2="36" y2="20"/><line x1="32" y1="10" x2="32" y2="16"/><line x1="32" y1="24" x2="32" y2="34"/>`),
  washing: svg(`<rect x="10" y="6" width="28" height="36" rx="3"/><circle cx="24" cy="28" r="8"/><circle cx="24" cy="28" r="3"/><rect x="14" y="10" width="20" height="6" rx="1"/>`),
  vacuum: svg(`<circle cx="24" cy="24" r="12"/><circle cx="24" cy="24" r="4"/><path d="M24 12a12 12 0 0 1 0 24"/><line x1="24" y1="4" x2="24" y2="12"/>`),
  air_fryer: svg(`<path d="M14 14a14 14 0 0 1 20 0"/><rect x="12" y="18" width="24" height="22" rx="4"/><circle cx="24" cy="29" r="5"/>`),
  oven: svg(`<rect x="8" y="8" width="32" height="32" rx="3"/><line x1="8" y1="16" x2="40" y2="16"/><rect x="14" y="22" width="20" height="12" rx="1"/><circle cx="16" cy="12" r="1.5" fill="#e4e4e7"/><circle cx="22" cy="12" r="1.5" fill="#e4e4e7"/>`),
  dishwasher: svg(`<rect x="10" y="6" width="28" height="36" rx="3"/><line x1="10" y1="14" x2="38" y2="14"/><circle cx="24" cy="28" r="6"/><line x1="18" y1="28" x2="30" y2="28"/><line x1="24" y1="22" x2="24" y2="34"/>`),
  fan: svg(`<circle cx="24" cy="24" r="14"/><circle cx="24" cy="24" r="3"/><path d="M24 21c-2-8 2-14 2-14s6 4 4 12"/><path d="M27 24c8-2 14 2 14 2s-4 6-12 4"/><path d="M24 27c2 8-2 14-2 14s-6-4-4-12"/><path d="M21 24c-8 2-14-2-14-2s4-6 12-4"/>`),
  purifier: svg(`<rect x="14" y="6" width="20" height="36" rx="4"/><circle cx="24" cy="32" r="4"/><line x1="20" y1="14" x2="28" y2="14"/><line x1="20" y1="18" x2="28" y2="18"/><line x1="20" y1="22" x2="28" y2="22"/>`),

  // --- LIGHTING ---
  bulb: svg(`<circle cx="24" cy="18" r="10"/><path d="M20 28h8"/><path d="M20 32h8"/><path d="M21 36h6"/><path d="M24 8v-2"/><path d="M18 28v-4a6 6 0 0 1 12 0v4"/>`),
  light_strip: svg(`<rect x="4" y="20" width="40" height="8" rx="4"/><circle cx="12" cy="24" r="2" fill="#e4e4e7"/><circle cx="20" cy="24" r="2" fill="#e4e4e7"/><circle cx="28" cy="24" r="2" fill="#e4e4e7"/><circle cx="36" cy="24" r="2" fill="#e4e4e7"/>`),
  ceiling_light: svg(`<path d="M12 8h24"/><path d="M16 8l-4 16h24l-4-16"/><path d="M10 24c0 4 6 8 14 8s14-4 14-8"/>`),

  // --- BAGS / FASHION ---
  bag: svg(`<rect x="10" y="16" width="28" height="24" rx="3"/><path d="M18 16v-6a6 6 0 0 1 12 0v6"/>`),
  wallet: svg(`<rect x="8" y="14" width="32" height="20" rx="3"/><path d="M32 22h8v8h-8z"/><circle cx="36" cy="26" r="1.5" fill="#e4e4e7"/>`),
  belt: svg(`<rect x="4" y="20" width="40" height="8" rx="2"/><rect x="18" y="18" width="12" height="12" rx="1"/><circle cx="24" cy="24" r="2"/>`),
  sunglasses: svg(`<circle cx="16" cy="24" r="7"/><circle cx="32" cy="24" r="7"/><path d="M23 24h2"/><path d="M9 21L4 18"/><path d="M39 21l5-3"/>`),
  jewelry: svg(`<circle cx="24" cy="20" r="8"/><circle cx="24" cy="20" r="3"/><path d="M24 28v8"/><path d="M18 38h12"/>`),
  key_holder: svg(`<circle cx="20" cy="16" r="6"/><circle cx="20" cy="16" r="2"/><line x1="26" y1="16" x2="38" y2="16"/><line x1="34" y1="16" x2="34" y2="22"/><line x1="38" y1="16" x2="38" y2="20"/>`),
  passport: svg(`<rect x="12" y="6" width="24" height="36" rx="3"/><circle cx="24" cy="22" r="6"/><line x1="16" y1="34" x2="32" y2="34"/>`),

  // --- HOME / LIVING ---
  furniture: svg(`<rect x="8" y="14" width="32" height="18" rx="2"/><line x1="12" y1="32" x2="12" y2="40"/><line x1="36" y1="32" x2="36" y2="40"/><path d="M6 20h2v12H6z"/><path d="M40 20h2v12h-2z"/>`),
  bed: svg(`<rect x="4" y="22" width="40" height="12" rx="2"/><rect x="6" y="16" width="12" height="6" rx="1"/><line x1="8" y1="34" x2="8" y2="40"/><line x1="40" y1="34" x2="40" y2="40"/>`),
  desk: svg(`<rect x="6" y="14" width="36" height="4" rx="1"/><line x1="10" y1="18" x2="10" y2="38"/><line x1="38" y1="18" x2="38" y2="38"/><rect x="12" y="20" width="14" height="8" rx="1"/>`),
  mirror: svg(`<ellipse cx="24" cy="22" rx="12" ry="16"/><line x1="24" y1="38" x2="24" y2="44"/><line x1="16" y1="44" x2="32" y2="44"/>`),
  decor: svg(`<path d="M24 6c-8 0-14 12-14 22 0 6 6 10 14 10s14-4 14-10c0-10-6-22-14-22z"/><line x1="24" y1="22" x2="24" y2="38"/><path d="M18 28c4-2 8-2 12 0"/>`),
  storage: svg(`<rect x="8" y="6" width="32" height="12" rx="2"/><rect x="8" y="20" width="32" height="12" rx="2"/><rect x="8" y="34" width="32" height="8" rx="2"/><line x1="22" y1="10" x2="26" y2="10"/><line x1="22" y1="26" x2="26" y2="26"/><line x1="22" y1="38" x2="26" y2="38"/>`),
  mug: svg(`<rect x="10" y="12" width="20" height="24" rx="3"/><path d="M30 18h6a4 4 0 0 1 0 8h-6"/><line x1="10" y1="36" x2="30" y2="36"/>`),
  wardrobe: svg(`<rect x="8" y="4" width="32" height="36" rx="2"/><line x1="24" y1="4" x2="24" y2="40"/><line x1="20" y1="22" x2="22" y2="22"/><line x1="26" y1="22" x2="28" y2="22"/><line x1="12" y1="40" x2="12" y2="44"/><line x1="36" y1="40" x2="36" y2="44"/>`),

  // --- OUTDOOR / CAMPING ---
  camping: svg(`<path d="M8 38L24 10l16 28z"/><path d="M20 38v-8h8v8"/><line x1="24" y1="4" x2="24" y2="10"/><line x1="20" y1="6" x2="28" y2="6"/>`),
  tool: svg(`<path d="M14 34l16-16"/><circle cx="34" cy="14" r="6"/><circle cx="34" cy="14" r="2"/><path d="M10 38l4-4"/>`),

  // --- FOOD ---
  food_machine: svg(`<rect x="10" y="8" width="28" height="32" rx="3"/><circle cx="24" cy="24" r="8"/><line x1="16" y1="24" x2="32" y2="24"/><line x1="24" y1="16" x2="24" y2="32"/><rect x="16" y="12" width="16" height="4" rx="1"/>`),

  // --- GROOMING ---
  grooming: svg(`<rect x="20" y="4" width="8" height="28" rx="3"/><path d="M18 32h12v8a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4z"/><line x1="20" y1="12" x2="28" y2="12"/>`),

  // --- GENERIC ---
  generic: svg(`<rect x="10" y="10" width="28" height="28" rx="4"/><circle cx="24" cy="24" r="6"/><circle cx="24" cy="24" r="2"/>`),
  tag: svg(`<path d="M4 24V10a2 2 0 0 1 2-2h14l20 16-14 14z"/><circle cx="14" cy="16" r="3"/>`),
  gear: svg(`<circle cx="24" cy="24" r="6"/><path d="M24 4v4M24 40v4M4 24h4M40 24h4M10 10l3 3M35 35l3 3M10 38l3-3M35 13l3-3"/>`),
  gps: svg(`<circle cx="24" cy="20" r="14"/><circle cx="24" cy="20" r="4"/><path d="M24 34v10"/><path d="M18 42h12"/>`),
  shield: svg(`<path d="M24 4L8 10v12c0 10 8 18 16 22 8-4 16-12 16-22V10z"/><polyline points="18,24 22,28 30,18"/>`),
  curtain: svg(`<line x1="6" y1="8" x2="42" y2="8"/><path d="M10 8c0 0 2 12 6 20s8 12 8 12"/><path d="M38 8c0 0-2 12-6 20s-8 12-8 12"/>`),
};

// ── Keyword → icon mapping ──
const KEYWORD_MAP = [
  // Phones
  [["smartphone", "iphone", "ios-smartphone", "android-smartphone", "gaming-smartphone", "foldable-smartphone", "rugged-smartphone", "flagship-smartphone", "mid-range-smartphone", "entry-level-smartphone"], "smartphone"],
  [["tablet", "ipad"], "tablet"],
  [["laptop", "ultrabook", "notebook", "business-laptop", "student-laptop", "gaming-laptop", "2-in-1-laptop"], "laptop"],
  [["desktop", "all-in-one", "workstation", "mini-pc", "gaming-desktop"], "desktop"],
  // Watches
  [["smart-watch", "watch", "luxury-smart-watch", "kids-smart-watch", "outdoor-smart-watch", "health-monitoring-watch"], "watch"],
  [["fitness", "tracker", "band"], "fitness"],
  // Audio
  [["headphone", "over-ear", "on-ear", "noise-cancelling", "gaming-headset"], "headphone"],
  [["earphone", "in-ear", "earbud", "wireless-earbud"], "earphone"],
  [["speaker", "bluetooth-speaker", "portable-speaker", "home-audio"], "speaker"],
  [["soundbar"], "soundbar"],
  // Camera
  [["camera", "dslr", "compact-camera", "mirrorless", "professional-camera", "action-camera"], "camera"],
  // TV
  [["tv", "led-tv", "oled-tv", "qled-tv", "smart-tv", "4k-tv", "8k-tv"], "tv"],
  // Gaming
  [["console", "home-console", "retro-gaming"], "console"],
  [["handheld-console"], "handheld"],
  // Drones
  [["drone", "camera-drone", "racing-drone", "professional-drone", "mini-drone"], "drone"],
  // Storage
  [["hard-drive", "external-hard", "ssd", "nas", "network-storage"], "hard_drive"],
  [["usb-flash", "usb-drive"], "usb"],
  [["memory-card"], "memory_card"],
  // Chargers
  [["charger", "phone-charger", "fast-charger"], "charger"],
  [["cable", "usb-cable"], "cable"],
  [["wireless-charger"], "wireless_charger"],
  [["power-bank"], "power_bank"],
  // Printers
  [["printer", "inkjet", "laser-printer", "all-in-one-printer", "portable-printer", "sublimation"], "printer"],
  // VR
  [["vr", "ar-device", "mixed-reality"], "vr"],
  // Streaming
  [["streaming", "tv-streaming", "media-player"], "tv"],
  // Accessories
  [["phone-accessory", "computer-accessory", "camera-accessory", "gaming-accessory", "audio-accessory"], "accessory"],
  // Vehicles
  [["electric-car", "electric-scooter", "electric-motorcycle", "electric-bicycle", "electric-utility"], "car"],
  [["e-scooter", "hoverboard", "mobility-device"], "scooter"],
  [["e-bike", "cargo-bike"], "bicycle"],
  [["delivery-vehicle", "industrial-mobility", "utility-transport"], "truck"],
  // EV charging
  [["ev-charger", "home-ev", "charging-station", "commercial-charging", "fast-charging-system"], "ev_charger"],
  // GPS / fleet
  [["gps", "fleet-management", "vehicle-iot", "smart-dash-camera", "dash-camera"], "gps"],
  // Spare parts
  [["spare-part", "tire", "maintenance-tool", "battery-system", "power-solution"], "gear"],
  [["servo-motor", "direct-drive", "touch-screen", "control-panel", "machine-part", "attachments-folder"], "gear"],
  // Solar
  [["solar-panel", "solar-kit", "solar-inverter", "solar-mounting", "solar-smart"], "solar"],
  // Battery
  [["lithium-batter", "lead-acid", "home-storage-system", "industrial-battery"], "battery"],
  // Inverter
  [["inverter"], "inverter"],
  // Generator / UPS
  [["generator", "backup-power"], "generator"],
  [["ups"], "ups"],
  // Power distribution
  [["electrical-panel", "switchgear", "transformer", "distribution-system"], "switchgear"],
  // Energy management
  [["smart-energy-meter", "energy-monitoring", "monitoring-system", "power-optimization"], "meter"],
  // Sewing machines
  [["lockstitch", "overlock", "interlock", "chainstitch", "double-needle", "multi-needle", "heavy-duty", "special-machine", "pattern-sewing", "bartacking", "buttonhole", "household-lockstitch", "household-overlock", "portable-sewing"], "sewing"],
  // Automatic sewing
  [["pocket-setter", "pocket-welting", "placket-sewing", "side-seam", "hemming", "collar-machine", "button-attaching", "sleeve-setting"], "sewing"],
  // Embroidery
  [["embroidery", "single-head-embroidery", "multi-head-embroidery", "computerized-embroidery", "cording-beading", "sequin-embroidery", "household-embroidery"], "embroidery"],
  // Cutting
  [["straight-knife", "round-knife", "band-knife", "strip-cutting", "end-cutter", "tape-cutting", "cnc-cutting", "laser-cutting", "fabric-drilling", "cnc-machine"], "cutting"],
  // Leather / footwear
  [["shoe-sewing", "bag-sewing", "leather-sewing", "edge-binding", "tape-attaching"], "sewing"],
  // Heat press / printing
  [["heat-press", "rotary-heat-press", "pneumatic-heat-press", "double-station", "screen-printing", "digital-textile-printer", "industrial-printer", "industrial-marking"], "press"],
  // Finishing
  [["steam-iron", "ironing-table", "vacuum-ironing", "collar-cuff-press", "form-finishing", "thread-sucking", "fusing-press", "steam-boiler", "washing-machine"], "iron"],
  // Fabric preparation
  [["spreading-machine", "fabric-relaxing", "fabric-inspection", "fabric-cutting-table", "fabric-rolling", "fabric-handling"], "roll"],
  // Packing / inspection
  [["needle-detector", "metal-detector", "packing-table", "folding-machine", "carton-sealing", "fabric-inspection-final", "x-ray-inspection"], "box"],
  // Fabrics
  [["cotton-fabric", "polyester-fabric", "denim-fabric", "twill-fabric", "blended-fabric"], "fabric"],
  [["single-jersey", "rib-knit", "interlock-fabric", "fleece-fabric", "warp-knit"], "fabric"],
  [["silk-fabric", "chiffon-fabric", "satin-fabric", "lace-fabric", "velvet-fabric"], "fabric"],
  [["waterproof-fabric", "fire-resistant", "anti-static", "uv-protection", "industrial-fabric"], "fabric"],
  [["curtain-fabric", "sofa-fabric", "upholstery-fabric", "bedding-fabric"], "curtain"],
  [["thread", "zipper", "button", "elastic-band", "label"], "tag"],
  // Robots
  [["industrial-robot", "automated-production", "robotic-arm"], "robotic_arm"],
  [["robot-vacuum", "robot-mop", "window-cleaning-robot"], "vacuum"],
  // CNC
  [["cnc"], "cnc"],
  [["filling-machine", "sealing-machine", "labeling-machine", "wrapping-machine"], "sealing"],
  [["food-processing", "production-line", "food-packaging"], "food_machine"],
  [["air-compressor", "workshop-equipment", "maintenance-tool"], "machine"],
  // Medical
  [["hospital-bed"], "hospital_bed"],
  [["wheelchair", "mobility-aid"], "wheelchair"],
  [["ultrasound", "x-ray-machine", "ecg-machine", "patient-monitor", "blood-analysis"], "ecg"],
  [["lab-testing", "centrifuge", "microscope"], "microscope"],
  [["surgical-instrument", "operating-table", "surgical-light"], "surgical_tool"],
  [["glove", "mask", "syringe", "disposable-product"], "mask"],
  [["infusion-pump"], "infusion"],
  [["oxygen-equipment"], "oxygen"],
  [["physiotherapy", "recovery-equipment"], "stethoscope"],
  // Smart home
  [["smart-control-panel", "smart-hub", "smart-gateway", "home-automation", "voice-control", "smart-switch", "smart-socket", "smart-curtain", "smart-blind", "smart-sensor"], "smart_home"],
  [["smart-lock", "smart-door-lock", "access-control"], "smart_lock"],
  [["smart-camera", "video-doorbell", "alarm-system", "motion-detection", "intercom"], "camera_security"],
  [["smart-thermostat"], "thermostat"],
  // Appliances
  [["smart-refrigerator"], "fridge"],
  [["smart-washing", "smart-dishwasher"], "washing"],
  [["smart-air-conditioner", "humidifier", "dehumidifier", "air-purifier", "air-quality"], "purifier"],
  [["smart-fan"], "fan"],
  [["smart-oven", "smart-cooker", "smart-air-fryer", "small-smart-appliance"], "air_fryer"],
  [["robot-vacuum", "smart-vacuum", "smart-cleaning"], "vacuum"],
  // Lighting
  [["smart-led-bulb", "decorative-smart-lighting"], "bulb"],
  [["smart-light-strip"], "light_strip"],
  [["smart-ceiling-light", "smart-outdoor-lighting", "lighting-control", "dimmers-smart-switch"], "ceiling_light"],
  // Furniture
  [["smart-bed"], "bed"],
  [["smart-desk", "ergonomic"], "desk"],
  [["smart-mirror"], "mirror"],
  [["smart-wardrobe"], "wardrobe"],
  [["smart-power-strip", "smart-battery", "ev-charger-home-use", "solar-smart"], "charger"],
  // Bags
  [["backpack", "business-bag", "laptop-bag", "travel-bag", "luggage", "travel-organizer", "passport-holder"], "bag"],
  // Fashion
  [["wallet"], "wallet"],
  [["belt"], "belt"],
  [["sunglasses"], "sunglasses"],
  [["watch"], "watch"],
  [["jewelry", "key-holder"], "jewelry"],
  // Personal
  [["grooming", "personal-care"], "grooming"],
  [["daily-carry", "smart-personal-gadget", "portable-accessory"], "accessory"],
  // Home living
  [["home-decor", "daily-home-essential"], "decor"],
  [["kitchen-tool"], "mug"],
  [["drinkware", "mug", "bottle"], "mug"],
  [["storage-solution", "home-storage"], "storage"],
  // Outdoor
  [["camping-gear"], "camping"],
  [["outdoor-tool"], "tool"],
  [["travel-accessory", "sports-lifestyle"], "bag"],
  // Premium
  [["luxury-accessory", "gift-set", "limited-edition"], "jewelry"],
];

function getIconForSlug(slug) {
  for (const [keywords, iconKey] of KEYWORD_MAP) {
    for (const kw of keywords) {
      if (slug.includes(kw) || slug === kw) return ICONS[iconKey];
    }
  }
  return ICONS.generic;
}

async function main() {
  console.log("Fetching subcategories...");
  const { data: subs } = await supabase.from("subcategories").select("slug,name").order("order");
  if (!subs || subs.length === 0) { console.log("No subcategories found."); return; }
  console.log(`Found ${subs.length} subcategories. Generating & uploading icons...`);

  let success = 0, fail = 0, skip = 0;

  // Check existing
  const { data: existing } = await supabase.storage.from(BUCKET).list(FOLDER, { limit: 1000 });
  const existingSlugs = new Set((existing || []).filter(f => f.name !== ".emptyFolderPlaceholder").map(f => f.name.replace(/\.[^.]+$/, "")));

  for (const sub of subs) {
    if (existingSlugs.has(sub.slug)) { skip++; continue; }

    const svgContent = getIconForSlug(sub.slug);
    const filePath = `${FOLDER}/${sub.slug}.svg`;
    const blob = new Blob([svgContent], { type: "image/svg+xml" });

    const { error } = await supabase.storage.from(BUCKET).upload(filePath, blob, {
      cacheControl: "3600",
      upsert: true,
      contentType: "image/svg+xml",
    });

    if (error) {
      console.error(`  FAIL: ${sub.slug} — ${error.message}`);
      fail++;
    } else {
      success++;
    }
  }

  console.log(`\nDone! Uploaded: ${success}, Skipped (existing): ${skip}, Failed: ${fail}`);
}

main().catch(console.error);
