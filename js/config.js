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
