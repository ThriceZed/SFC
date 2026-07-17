// ============================================================
// Demo seed data, used only when SFC runs in local demo mode.
// Mirrors the Supabase schema so the UI behaves identically.
// ============================================================

window.SFC_SEED = {
  profiles: [
    {
      id: "u_maya", first_name: "Maya", last_name: "Okonkwo", username: "mayadp", full_name: "Maya Okonkwo",
      is_group: false, group_name: "",
      roles: ["Cinematographer (DP)", "Colorist"], experience: "advanced",
      gear_list: ["Blackmagic Pocket 6K", "DJI RS3 / Gimbal", "Aputure 120D / 300D"],
      gear: "DZOFilm primes", badges: ["SFC+"],
      location: "Austin, TX", area_code: "78701",
      bio: "Senior at UT Austin. I light for mood: noir, neon, natural. Down to travel for the right story.",
      contact_email: "maya@example.edu", contact_ig: "@maya.shoots", contact_phone: "",
    },
    {
      id: "u_theo", first_name: "Theo", last_name: "Alvarez", username: "theocuts", full_name: "Theo Alvarez",
      is_group: false, group_name: "",
      roles: ["Editor", "VFX Artist"], experience: "intermediate",
      gear_list: ["DaVinci Resolve Studio", "After Effects", "Editing Workstation"],
      gear: "M2 Max laptop", badges: [],
      location: "Austin, TX", area_code: "78704",
      bio: "Post-focused. Fast turnarounds, clean cuts, tasteful comps.",
      contact_email: "theo@example.edu", contact_ig: "@theo.cuts", contact_phone: "",
    },
    {
      id: "u_lenscollective", first_name: "Lens", last_name: "Collective", username: "lenscollective", full_name: "Lens Collective",
      is_group: true, group_name: "Lens Collective",
      roles: ["Producer", "Production Designer"], experience: "advanced",
      gear_list: ["Grip Truck", "HMI Kit", "Dolly + Track"],
      gear: "3x HMI kit", badges: ["SFC+", "Staff"],
      location: "Round Rock, TX", area_code: "78664",
      bio: "Student production co-op. We crew, we produce, we finish films.",
      contact_email: "hello@example.org", contact_ig: "@lenscollective", contact_phone: "",
    },
  ],

  productions: [
    {
      id: "p_neon", creator_id: "u_lenscollective",
      title: "NEON VEINS", type: "project",
      logline: "A courier discovers the city's lights are alive, and hungry.",
      description: "Neo-noir short, ~9 min. Two night shoots downtown. Small tight crew, big look. Festival ambitions.",
      open_to_any: false,
      roles_needed: [
        { role: "Gaffer", count: 1 }, { role: "Sound", count: 1 },
        { role: "Production Assistant", count: 2 }, { role: "Actor", count: 2 },
      ],
      start_date: "2026-08-14", end_date: "2026-08-15",
      location: "Austin, TX", area_code: "78701",
      paid: false, gear_provided: "Camera, lighting, and grip provided by Lens Collective.",
      status: "recruiting", awards: "Official Selection: Austin Student Film Fest 2025 (prior work)",
      notable: true, created_at: "2026-07-10T18:00:00Z",
    },
    {
      id: "p_dawn", creator_id: "u_maya",
      title: "Before the Dawn Shift", type: "shoot",
      logline: "A single-day doc portrait of an all-night diner.",
      description: "One long shoot day, run-and-gun documentary style. Looking for a second shooter and a sound person.",
      open_to_any: false,
      roles_needed: [ { role: "Camera Operator", count: 1 }, { role: "Sound", count: 1 } ],
      start_date: "2026-07-29", end_date: "2026-07-29",
      location: "Austin, TX", area_code: "78704",
      paid: true, gear_provided: "Cinema camera + lenses provided. Bring your own audio kit if you have one.",
      status: "recruiting", awards: "",
      notable: false, created_at: "2026-07-13T15:30:00Z",
    },
    {
      id: "p_thesis", creator_id: "u_theo",
      title: "Paper Boats (Thesis Film)", type: "project",
      logline: "Two estranged siblings rebuild a childhood raft to scatter their father's ashes.",
      description: "Grad thesis drama, 3 shoot days across a lake house. Warm, tender, character-driven. Open to passionate first-timers who want real set experience.",
      open_to_any: true,
      roles_needed: [],
      start_date: "2026-09-05", end_date: "2026-09-07",
      location: "Marble Falls, TX", area_code: "78654",
      paid: false, gear_provided: "Full package provided. Meals + gas covered.",
      status: "recruiting", awards: "Winner: Best Screenplay, Regional Student Showcase 2024",
      notable: true, created_at: "2026-07-05T12:00:00Z",
    },
  ],

  applications: [],
};
