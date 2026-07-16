// ============================================================
// SFC: Student Film Connection · configuration
// ------------------------------------------------------------
// Paste your Supabase project credentials below to switch from
// local DEMO mode to a real shared backend. Until both fields
// are filled in, the site runs entirely in your browser using
// seeded demo data (see js/seed.js).
//
//   1. Create a free project at https://supabase.com
//   2. Run supabase/schema.sql in the SQL editor
//   3. Copy Project URL + anon/public key from Project Settings → API
//   4. Paste them here and reload
// ============================================================

window.SFC_CONFIG = {
  SUPABASE_URL: "",       // e.g. "https://abcd1234.supabase.co"
  SUPABASE_ANON_KEY: "",  // the long anon/public key

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
