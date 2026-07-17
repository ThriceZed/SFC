// ============================================================
// SFC: Student Film Connection · configuration
// ------------------------------------------------------------
// LIVE: backed by the Supabase project below. Blanking either
// credential drops the site back to demo mode, where all data
// lives in the visitor's own browser (see js/seed.js).
// ============================================================

window.SFC_CONFIG = {
  // Safe to commit: this is a public client key. Access is enforced by the
  // row-level security policies in supabase/schema.sql, not by secrecy.
  // Never put the sb_secret_... key in this file. It bypasses RLS entirely
  // and this repo is public.
  SUPABASE_URL: "https://chtuwgdoupvalavfsjgc.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_dpn-cCs4ckw21k2Iytee6Q_zHFaHexr",

  // Shared roster of crew roles used across signup, profiles, and productions.
  ROLES: [
    "Director", "Producer", "Writer",
    "Cinematographer (DP)", "Camera Operator", "Gaffer", "Grip",
    "Sound", "Boom Op", "Editor", "Colorist", "VFX Artist",
    "Production Designer", "Art Department", "Makeup / Hair",
    "Composer", "Actor", "Production Assistant",
  ],

  EXPERIENCE: [
    { id: "first-timer",  label: "First-timer" },
    { id: "intermediate", label: "Intermediate" },
    { id: "advanced",     label: "Advanced" },
  ],

  // Profile badges. These are deliberately NOT self-serve: a trigger in the
  // migration blocks clients from writing their own badges, so they can only
  // be granted from the SQL editor. Add new ones here and they render anywhere
  // badges appear.
  BADGES: {
    "SFC+":  { cls: "badge-plus",  title: "SFC+ subscriber" },
    "Staff": { cls: "badge-staff", title: "Student Film Connection staff" },
  },

  // Gear picker. Grouped presets to click, plus a free-text "Other" box for
  // anything not listed. Keep the lists tight: this is student kit, not a
  // rental house catalog.
  GEAR: {
    Cameras: [
      "Sony A7 IV", "Sony FX3", "Sony FX30", "Sony FX6",
      "Canon EOS R5", "Canon R6", "Canon C70",
      "Blackmagic Pocket 4K", "Blackmagic Pocket 6K",
      "Panasonic GH6", "Panasonic S5 II", "Lumix GH5",
      "Nikon Z6", "Fujifilm X-T4", "RED Komodo", "ARRI Alexa Mini",
      "DSLR (Older)", "iPhone / Smartphone",
    ],
    Lenses: [
      "Kit Zoom", "Nifty Fifty (50mm)", "Sigma Art Primes",
      "Rokinon / Samyang Cine Primes", "Canon RF Primes", "Sony G Master Zoom",
      "Vintage Manual Primes", "Macro Lens", "Anamorphic Adapter",
    ],
    Audio: [
      "Zoom H4n / H5 / H6", "Tascam DR-40X", "Zoom F6 Recorder",
      "Rode NTG Shotgun", "Sennheiser MKE 600", "Rode VideoMic",
      "Rode Wireless GO II", "Sennheiser G4 Lav", "Boom Pole", "Blimp / Deadcat",
    ],
    Lighting: [
      "Aputure 120D / 300D", "Aputure MC Pocket", "Nanlite / Godox LED",
      "LED Panel Kit", "Softbox Kit", "HMI Kit", "Practicals / China Ball",
      "Reflector / Bounce", "Flags + C-Stands",
    ],
    Support: [
      "Tripod (Fluid Head)", "DJI RS3 / Gimbal", "Shoulder Rig",
      "Slider", "Dolly + Track", "Drone (DJI)", "Car Mount", "Grip Truck",
    ],
    Post: [
      "DaVinci Resolve Studio", "Adobe Premiere Pro", "Final Cut Pro",
      "After Effects", "Pro Tools", "Color-Calibrated Monitor",
      "Editing Workstation",
    ],
  },
};

window.SFC_LIVE = !!(window.SFC_CONFIG.SUPABASE_URL && window.SFC_CONFIG.SUPABASE_ANON_KEY);

// Only pull in the Supabase client library when real credentials are set.
// document.write here guarantees it finishes loading before store.js parses,
// so the LIVE backend can call window.supabase synchronously. In demo mode
// no external request is made at all.
if (window.SFC_LIVE) {
  document.write(
    '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"><\/script>');
}
