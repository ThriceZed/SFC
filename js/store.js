// ============================================================
// SFC data layer
// ------------------------------------------------------------
// One async API, two backends:
//   • DEMO: everything lives in localStorage, seeded from
//             js/seed.js. No sharing between browsers. Great
//             for clicking through the whole experience today.
//   • LIVE: real Supabase (auth + Postgres) once keys are
//             filled into js/config.js.
//
// All methods return Promises so pages don't care which mode
// is active. Errors reject with a plain Error(message).
// ============================================================

(function () {
  const LIVE = window.SFC_LIVE;
  const LS = {
    profiles: "sfc.profiles",
    productions: "sfc.productions",
    applications: "sfc.applications",
    session: "sfc.session",
    creds: "sfc.creds", // demo-only fake password store
    seeded: "sfc.seeded",
  };

  // ---------- small helpers ----------
  const uid = (p = "id") => p + "_" + Math.random().toString(36).slice(2, 9);
  const read = (k, fallback) => {
    try { return JSON.parse(localStorage.getItem(k)) ?? fallback; }
    catch { return fallback; }
  };
  const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));

  // Rough proximity: numeric distance between US-style area/zip codes.
  // Not real geography, but good enough to sort "closer first" in demo.
  function areaDistance(a, b) {
    if (!a || !b) return Number.MAX_SAFE_INTEGER;
    const na = parseInt(String(a).slice(0, 5), 10);
    const nb = parseInt(String(b).slice(0, 5), 10);
    if (isNaN(na) || isNaN(nb)) return Number.MAX_SAFE_INTEGER;
    return Math.abs(na - nb);
  }

  // ================================================================
  // DEMO backend
  // ================================================================
  const Demo = {
    _seedOnce() {
      if (read(LS.seeded, false)) return;
      write(LS.profiles, window.SFC_SEED.profiles);
      write(LS.productions, window.SFC_SEED.productions);
      write(LS.applications, window.SFC_SEED.applications);
      write(LS.creds, {});
      write(LS.seeded, true);
    },

    async getCurrentUser() {
      const s = read(LS.session, null);
      if (!s) return null;
      const p = read(LS.profiles, []).find((x) => x.id === s.id);
      return p || null;
    },

    async signUp(email, password, profile) {
      const creds = read(LS.creds, {});
      const profiles = read(LS.profiles, []);
      if (creds[email.toLowerCase()]) throw new Error("An account with that email already exists.");
      if (profiles.some((p) => p.username === profile.username))
        throw new Error("That username is taken.");
      const id = uid("u");
      const record = { id, contact_email: email, ...profile };
      profiles.push(record);
      creds[email.toLowerCase()] = { id, password };
      write(LS.profiles, profiles);
      write(LS.creds, creds);
      write(LS.session, { id });
      return record;
    },

    async signIn(email, password) {
      const creds = read(LS.creds, {});
      const entry = creds[email.toLowerCase()];
      if (!entry || entry.password !== password)
        throw new Error("Wrong email or password.");
      write(LS.session, { id: entry.id });
      return read(LS.profiles, []).find((p) => p.id === entry.id);
    },

    async signOut() { localStorage.removeItem(LS.session); },

    async getProfile(id) {
      return read(LS.profiles, []).find((p) => p.id === id) || null;
    },

    async getProfiles(ids) {
      const set = new Set(ids);
      return read(LS.profiles, []).filter((p) => set.has(p.id));
    },

    async updateProfile(patch) {
      const s = read(LS.session, null);
      if (!s) throw new Error("Not signed in.");
      const profiles = read(LS.profiles, []);
      const i = profiles.findIndex((p) => p.id === s.id);
      profiles[i] = { ...profiles[i], ...patch };
      write(LS.profiles, profiles);
      return profiles[i];
    },

    async listProductions(filters = {}, userArea = "") {
      let list = read(LS.productions, []).slice();
      const { role, paid, experience, when, notableOnly, query } = filters;
      if (notableOnly) list = list.filter((p) => p.notable);
      if (query) {
        const q = query.toLowerCase();
        list = list.filter((p) =>
          (p.title + " " + p.logline + " " + p.description).toLowerCase().includes(q));
      }
      if (role) list = list.filter((p) =>
        p.open_to_any || (p.roles_needed || []).some((r) => r.role === role));
      if (paid === "paid") list = list.filter((p) => p.paid);
      if (paid === "unpaid") list = list.filter((p) => !p.paid);
      if (when === "week" || when === "month") {
        const now = new Date();
        const horizon = new Date(now.getTime() + (when === "week" ? 7 : 30) * 864e5);
        list = list.filter((p) => {
          const d = new Date(p.start_date);
          return d >= new Date(now.toDateString()) && d <= horizon;
        });
      }
      // default sort: closest first, then soonest
      list.sort((a, b) => {
        const da = areaDistance(userArea, a.area_code);
        const db = areaDistance(userArea, b.area_code);
        if (da !== db) return da - db;
        return new Date(a.start_date) - new Date(b.start_date);
      });
      return list;
    },

    async getProduction(id) {
      return read(LS.productions, []).find((p) => p.id === id) || null;
    },

    async createProduction(data) {
      const s = read(LS.session, null);
      if (!s) throw new Error("Sign in to create a production.");
      const productions = read(LS.productions, []);
      const record = {
        id: uid("p"), creator_id: s.id, notable: false,
        status: "recruiting", created_at: new Date().toISOString(), ...data,
      };
      productions.unshift(record);
      write(LS.productions, productions);
      return record;
    },

    async updateProduction(id, patch) {
      const productions = read(LS.productions, []);
      const i = productions.findIndex((p) => p.id === id);
      if (i < 0) throw new Error("Production not found.");
      productions[i] = { ...productions[i], ...patch };
      write(LS.productions, productions);
      return productions[i];
    },

    async listUserProductions(userId) {
      return read(LS.productions, []).filter((p) => p.creator_id === userId);
    },

    async apply(productionId, role, message) {
      const s = read(LS.session, null);
      if (!s) throw new Error("Sign in to apply.");
      const apps = read(LS.applications, []);
      if (apps.some((a) => a.production_id === productionId && a.applicant_id === s.id))
        throw new Error("You've already applied to this production.");
      const record = {
        id: uid("a"), production_id: productionId, applicant_id: s.id,
        role, message, status: "pending", created_at: new Date().toISOString(),
      };
      apps.push(record);
      write(LS.applications, apps);
      return record;
    },

    async listApplicationsForProduction(productionId) {
      return read(LS.applications, []).filter((a) => a.production_id === productionId);
    },

    async listUserApplications(userId) {
      return read(LS.applications, []).filter((a) => a.applicant_id === userId);
    },

    async setApplicationStatus(appId, status) {
      const apps = read(LS.applications, []);
      const i = apps.findIndex((a) => a.id === appId);
      apps[i].status = status;
      apps[i].updated_at = new Date().toISOString();
      write(LS.applications, apps);
      return apps[i];
    },

    async searchProfiles(query) {
      const q = query.trim().toLowerCase().replace(/^@/, "");
      if (!q) return [];
      return read(LS.profiles, []).filter((p) =>
        (p.username || "").toLowerCase().includes(q) ||
        (p.full_name || "").toLowerCase().includes(q)).slice(0, 8);
    },

    // Owner puts a known collaborator straight onto the roster.
    async addCrew(productionId, applicantId, role) {
      const apps = read(LS.applications, []);
      if (apps.some((a) => a.production_id === productionId && a.applicant_id === applicantId))
        throw new Error("They're already on this production.");
      const record = {
        id: uid("a"), production_id: productionId, applicant_id: applicantId,
        role, message: "Added by the creator", status: "accepted",
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      };
      apps.push(record);
      write(LS.applications, apps);
      return record;
    },
  };

  // ================================================================
  // LIVE backend (Supabase)
  // ================================================================
  const Live = (() => {
    let sb = null;
    function client() {
      if (!sb) {
        if (!window.supabase) throw new Error("Supabase client library failed to load.");
        sb = window.supabase.createClient(
          window.SFC_CONFIG.SUPABASE_URL, window.SFC_CONFIG.SUPABASE_ANON_KEY);
      }
      return sb;
    }
    const must = ({ data, error }) => { if (error) throw new Error(error.message); return data; };

    async function currentAuthId() {
      const { data } = await client().auth.getUser();
      return data?.user?.id || null;
    }

    return {
      async getCurrentUser() {
        const id = await currentAuthId();
        if (!id) return null;
        return must(await client().from("profiles").select("*").eq("id", id).single());
      },
      // The profile row is created server-side by the handle_new_user()
      // trigger in supabase/schema.sql, which reads these fields back out
      // of raw_user_meta_data. We cannot insert it from here: signUp does
      // not return a session when email confirmation is on, so the insert
      // would be anonymous and RLS would reject it.
      async signUp(email, password, profile) {
        const { data, error } = await client().auth.signUp({
          email, password, options: { data: profile },
        });
        if (error) throw new Error(error.message);
        if (!data.session) {
          throw new Error(
            "Account created. Check your email to confirm it, then log in.");
        }
        return this.getCurrentUser();
      },
      async signIn(email, password) {
        const { error } = await client().auth.signInWithPassword({ email, password });
        if (error) throw new Error(error.message);
        return this.getCurrentUser();
      },
      async signOut() { await client().auth.signOut(); },
      async getProfile(id) {
        return must(await client().from("profiles").select("*").eq("id", id).maybeSingle());
      },
      async getProfiles(ids) {
        return must(await client().from("profiles").select("*").in("id", ids));
      },
      async updateProfile(patch) {
        const id = await currentAuthId();
        return must(await client().from("profiles").update(patch).eq("id", id).select().single());
      },
      async listProductions(filters = {}, userArea = "") {
        let q = client().from("productions").select("*");
        if (filters.notableOnly) q = q.eq("notable", true);
        if (filters.paid === "paid") q = q.eq("paid", true);
        if (filters.paid === "unpaid") q = q.eq("paid", false);
        let list = must(await q);
        // remaining filters + proximity sort done client-side for parity with demo
        if (filters.query) {
          const s = filters.query.toLowerCase();
          list = list.filter((p) =>
            (p.title + " " + p.logline + " " + p.description).toLowerCase().includes(s));
        }
        if (filters.role) list = list.filter((p) =>
          p.open_to_any || (p.roles_needed || []).some((r) => r.role === filters.role));
        list.sort((a, b) => {
          const da = areaDistance(userArea, a.area_code);
          const db = areaDistance(userArea, b.area_code);
          if (da !== db) return da - db;
          return new Date(a.start_date) - new Date(b.start_date);
        });
        return list;
      },
      async getProduction(id) {
        return must(await client().from("productions").select("*").eq("id", id).maybeSingle());
      },
      async createProduction(data) {
        const id = await currentAuthId();
        return must(await client().from("productions")
          .insert({ creator_id: id, ...data }).select().single());
      },
      async updateProduction(id, patch) {
        return must(await client().from("productions").update(patch).eq("id", id).select().single());
      },
      async listUserProductions(userId) {
        return must(await client().from("productions").select("*").eq("creator_id", userId));
      },
      async apply(productionId, role, message) {
        const id = await currentAuthId();
        return must(await client().from("applications")
          .insert({ production_id: productionId, applicant_id: id, role, message }).select().single());
      },
      async listApplicationsForProduction(productionId) {
        return must(await client().from("applications").select("*").eq("production_id", productionId));
      },
      async listUserApplications(userId) {
        return must(await client().from("applications").select("*").eq("applicant_id", userId));
      },
      async setApplicationStatus(appId, status) {
        return must(await client().from("applications").update({ status }).eq("id", appId).select().single());
      },
      async searchProfiles(query) {
        const q = query.trim().replace(/^@/, "");
        if (!q) return [];
        return must(await client().from("profiles").select("*")
          .or(`username.ilike.%${q}%,full_name.ilike.%${q}%`).limit(8));
      },
      // Relies on the "owner adds crew" insert policy from migration_002.sql.
      async addCrew(productionId, applicantId, role) {
        return must(await client().from("applications").insert({
          production_id: productionId, applicant_id: applicantId,
          role, message: "Added by the creator", status: "accepted",
        }).select().single());
      },
    };
  })();

  // ================================================================
  // Public API
  // ================================================================
  const backend = LIVE ? Live : Demo;
  if (!LIVE) Demo._seedOnce();

  window.SFC = Object.assign({}, backend, {
    LIVE,
    areaDistance,
    resetDemo() {
      Object.values(LS).forEach((k) => localStorage.removeItem(k));
      Demo._seedOnce();
    },
  });
})();
