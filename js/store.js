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
    follows: "sfc.follows",
    friendships: "sfc.friendships",
    codes: "sfc.codes",
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
      const { badges: _ignored, ...safe } = profile;
      const record = { id, contact_email: email, badges: [], gear_list: [], gear: "", ...safe };
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
      // Badges are granted server-side only. Mirror the live protect_profile_badges
      // trigger by dropping any client attempt to set them.
      const { badges, ...safe } = patch;
      profiles[i] = { ...profiles[i], ...safe };
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

    async deleteProduction(id) {
      write(LS.productions, read(LS.productions, []).filter((p) => p.id !== id));
      // Mirrors the on-delete-cascade the live schema does for us.
      write(LS.applications, read(LS.applications, []).filter((a) => a.production_id !== id));
      return true;
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

    // Mirrors the live "read own or owned applications" + "staff read
    // applications" RLS policies: the owner and staff see every application
    // (messages included), everyone else sees only their own row, and a
    // logged-out visitor sees none. Demo mode has no database to enforce
    // this, so it has to happen here instead of relying on the UI to just
    // not render what it was handed.
    async listApplicationsForProduction(productionId) {
      const all = read(LS.applications, []).filter((a) => a.production_id === productionId);
      const s = read(LS.session, null);
      if (!s) return [];
      const prod = read(LS.productions, []).find((p) => p.id === productionId);
      const me = read(LS.profiles, []).find((p) => p.id === s.id);
      const privileged = prod?.creator_id === s.id || (me?.badges || []).includes("Staff");
      return privileged ? all : all.filter((a) => a.applicant_id === s.id);
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
    async addCrew(productionId, applicantId, role, canEdit = false) {
      const apps = read(LS.applications, []);
      if (apps.some((a) => a.production_id === productionId && a.applicant_id === applicantId))
        throw new Error("They're already on this production.");
      const record = {
        id: uid("a"), production_id: productionId, applicant_id: applicantId,
        role, message: "Added by the creator", status: "accepted",
        added_by_creator: true, can_edit: !!canEdit,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      };
      apps.push(record);
      write(LS.applications, apps);
      return record;
    },

    // ---------- staff: profile moderation ----------
    async listAllProfiles() {
      return read(LS.profiles, []);
    },
    async adminUpdateProfile(userId, patch) {
      const s = read(LS.session, null);
      const me = read(LS.profiles, []).find((p) => p.id === s?.id);
      if (!(me?.badges || []).includes("Staff")) throw new Error("Staff only.");
      const { badges, ...safe } = patch; // same protection as updateProfile
      const profiles = read(LS.profiles, []);
      const i = profiles.findIndex((p) => p.id === userId);
      if (i < 0) throw new Error("Profile not found.");
      profiles[i] = { ...profiles[i], ...safe };
      write(LS.profiles, profiles);
      return profiles[i];
    },

    // ---------- follow / friend ----------
    // null when signed out, matching Live: the caller hides the controls.
    async getRelationship(otherId) {
      const s = read(LS.session, null);
      if (!s) return null;
      const follows = read(LS.follows, []);
      const friendships = read(LS.friendships, []);
      const following = follows.some((f) => f.follower_id === s.id && f.followee_id === otherId);
      const fr = friendships.find((f) =>
        (f.requester_id === s.id && f.addressee_id === otherId) ||
        (f.requester_id === otherId && f.addressee_id === s.id));
      let friendStatus = "none";
      if (fr) {
        if (fr.status === "accepted") friendStatus = "friends";
        else friendStatus = fr.requester_id === s.id ? "pending_out" : "pending_in";
      }
      return { following, friendStatus };
    },
    async follow(otherId) {
      const s = read(LS.session, null);
      if (!s) throw new Error("Sign in to follow people.");
      const follows = read(LS.follows, []);
      if (!follows.some((f) => f.follower_id === s.id && f.followee_id === otherId)) {
        follows.push({ follower_id: s.id, followee_id: otherId, created_at: new Date().toISOString() });
        write(LS.follows, follows);
      }
      return true;
    },
    async unfollow(otherId) {
      const s = read(LS.session, null);
      if (!s) throw new Error("Not signed in.");
      write(LS.follows, read(LS.follows, [])
        .filter((f) => !(f.follower_id === s.id && f.followee_id === otherId)));
      return true;
    },
    async sendFriendRequest(otherId) {
      const s = read(LS.session, null);
      if (!s) throw new Error("Sign in to add friends.");
      const friendships = read(LS.friendships, []);
      if (friendships.some((f) =>
        (f.requester_id === s.id && f.addressee_id === otherId) ||
        (f.requester_id === otherId && f.addressee_id === s.id)))
        throw new Error("A friend request already exists between you two.");
      friendships.push({
        id: uid("f"), requester_id: s.id, addressee_id: otherId,
        status: "pending", created_at: new Date().toISOString(),
      });
      write(LS.friendships, friendships);
      return true;
    },
    async acceptFriendRequest(otherId) {
      const s = read(LS.session, null);
      if (!s) throw new Error("Not signed in.");
      const friendships = read(LS.friendships, []);
      const i = friendships.findIndex((f) =>
        f.requester_id === otherId && f.addressee_id === s.id && f.status === "pending");
      if (i < 0) throw new Error("No pending request from that person.");
      friendships[i].status = "accepted";
      write(LS.friendships, friendships);
      return true;
    },
    async removeFriendship(otherId) {
      const s = read(LS.session, null);
      if (!s) throw new Error("Not signed in.");
      write(LS.friendships, read(LS.friendships, []).filter((f) =>
        !((f.requester_id === s.id && f.addressee_id === otherId) ||
          (f.requester_id === otherId && f.addressee_id === s.id))));
      return true;
    },

    // ---------- SFC+ codes ----------
    async redeemCode(code) {
      const s = read(LS.session, null);
      if (!s) throw new Error("Sign in to redeem a code.");
      const codes = read(LS.codes, []);
      const i = codes.findIndex((c) => c.code === code.trim());
      if (i < 0 || codes[i].assigned_to) throw new Error("That code is invalid or already used.");
      codes[i].assigned_to = s.id;
      codes[i].assigned_at = new Date().toISOString();
      write(LS.codes, codes);
      // Mirrors the live redeem_sfc_plus_code() RPC, which grants the badge
      // via a security-definer function rather than a plain client update.
      const profiles = read(LS.profiles, []);
      const pi = profiles.findIndex((p) => p.id === s.id);
      const badges = new Set(profiles[pi].badges || []);
      badges.add("SFC+");
      profiles[pi] = { ...profiles[pi], badges: [...badges] };
      write(LS.profiles, profiles);
      return true;
    },
    async listCodes() {
      return read(LS.codes, []);
    },
    async createCode(code) {
      const s = read(LS.session, null);
      const me = read(LS.profiles, []).find((p) => p.id === s?.id);
      if (!(me?.badges || []).includes("Staff")) throw new Error("Staff only.");
      const codes = read(LS.codes, []);
      const value = (code || "SFC-" + Math.random().toString(36).slice(2, 6).toUpperCase()
        + "-" + Math.random().toString(36).slice(2, 6).toUpperCase()).trim();
      if (codes.some((c) => c.code === value)) throw new Error("That code already exists.");
      codes.push({ code: value, assigned_to: null, assigned_at: null, created_at: new Date().toISOString() });
      write(LS.codes, codes);
      return codes[codes.length - 1];
    },
    async deleteCode(code) {
      const s = read(LS.session, null);
      const me = read(LS.profiles, []).find((p) => p.id === s?.id);
      if (!(me?.badges || []).includes("Staff")) throw new Error("Staff only.");
      write(LS.codes, read(LS.codes, []).filter((c) => c.code !== code));
      return true;
    },
    // Mirrors the live set_sfc_plus() RPC. Deliberately not routed through
    // updateProfile, which strips badges the way the live trigger does.
    async setSfcPlus(userId, on) {
      const s = read(LS.session, null);
      const me = read(LS.profiles, []).find((p) => p.id === s?.id);
      if (!(me?.badges || []).includes("Staff")) throw new Error("Staff only.");
      const profiles = read(LS.profiles, []);
      const i = profiles.findIndex((p) => p.id === userId);
      if (i < 0) throw new Error("That profile no longer exists.");
      const badges = new Set(profiles[i].badges || []);
      on ? badges.add("SFC+") : badges.delete("SFC+");
      profiles[i] = { ...profiles[i], badges: [...badges] };
      write(LS.profiles, profiles);
      return true;
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
    // PostgREST's raw errors are unusable in a toast. An RLS refusal comes
    // back as zero rows, which .single() then reports as "Cannot coerce the
    // result to a single JSON object"; a table that doesn't exist yet leaks
    // its schema-cache internals. Translate the cases we actually hit.
    function friendlyError(error) {
      const msg = error?.message || "Something went wrong.";
      const missingTable = msg.match(/Could not find the table 'public\.(\w+)'/i);
      if (missingTable) {
        return `That feature isn't set up on the database yet (missing table: ${missingTable[1]}). ` +
               `Run the latest migration in supabase/.`;
      }
      // PGRST202: the RPC doesn't exist, i.e. a migration adding it hasn't run.
      if (error?.code === "PGRST202" || /Could not find the function/i.test(msg))
        return "That feature isn't set up on the database yet. Run the latest migration in supabase/.";
      // PGRST116: .single() got 0 rows. Almost always RLS refusing the write.
      if (error?.code === "PGRST116" || /coerce the result to a single JSON object/i.test(msg))
        return "You don't have permission to change that, or it no longer exists.";
      if (error?.code === "42501") return "You don't have permission to do that.";
      if (error?.code === "42703") return "That feature needs a database update. Run the latest migration in supabase/.";
      return msg;
    }
    const must = ({ data, error }) => { if (error) throw new Error(friendlyError(error)); return data; };

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
      // Allowed for the creator, or for staff via the "staff delete productions"
      // policy. Applications cascade away with the row.
      async deleteProduction(id) {
        const { error } = await client().from("productions").delete().eq("id", id);
        if (error) throw new Error(error.message);
        return true;
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
      async addCrew(productionId, applicantId, role, canEdit = false) {
        return must(await client().from("applications").insert({
          production_id: productionId, applicant_id: applicantId,
          role, message: "Added by the creator", status: "accepted",
          added_by_creator: true, can_edit: !!canEdit,
        }).select().single());
      },

      // ---------- staff: profile moderation ----------
      // "profiles readable" already allows select-all; "staff update profiles"
      // (migration_003.sql) is what lets this write to someone else's row.
      // protect_profile_badges still strips any badges key regardless.
      async listAllProfiles() {
        return must(await client().from("profiles").select("*").order("full_name"));
      },
      async adminUpdateProfile(userId, patch) {
        return must(await client().from("profiles").update(patch).eq("id", userId).select().single());
      },

      // ---------- follow / friend ----------
      async getRelationship(otherId) {
        const id = await currentAuthId();
        if (!id) return null;
        const [fRes, frRes] = await Promise.all([
          client().from("follows").select("follower_id").eq("follower_id", id).eq("followee_id", otherId).maybeSingle(),
          client().from("friendships").select("*")
            .or(`and(requester_id.eq.${id},addressee_id.eq.${otherId}),and(requester_id.eq.${otherId},addressee_id.eq.${id})`)
            .maybeSingle(),
        ]);
        // Surface a failure instead of swallowing it. The caller hides the
        // follow/friend controls when this throws, which is the right
        // outcome if the tables aren't there: no buttons beats buttons that
        // error the moment they're clicked.
        if (fRes.error) throw new Error(friendlyError(fRes.error));
        if (frRes.error) throw new Error(friendlyError(frRes.error));
        const fr = frRes.data;
        let friendStatus = "none";
        if (fr) {
          if (fr.status === "accepted") friendStatus = "friends";
          else friendStatus = fr.requester_id === id ? "pending_out" : "pending_in";
        }
        return { following: !!fRes.data, friendStatus };
      },
      async follow(otherId) {
        const id = await currentAuthId();
        const { error } = await client().from("follows").insert({ follower_id: id, followee_id: otherId });
        if (error && error.code !== "23505") throw new Error(error.message); // 23505 = already following
        return true;
      },
      async unfollow(otherId) {
        const id = await currentAuthId();
        const { error } = await client().from("follows").delete()
          .eq("follower_id", id).eq("followee_id", otherId);
        if (error) throw new Error(error.message);
        return true;
      },
      async sendFriendRequest(otherId) {
        const id = await currentAuthId();
        const { error } = await client().from("friendships")
          .insert({ requester_id: id, addressee_id: otherId });
        if (error) throw new Error(
          error.code === "23505" || error.message.includes("already exists")
            ? "A friend request already exists between you two." : error.message);
        return true;
      },
      async acceptFriendRequest(otherId) {
        const id = await currentAuthId();
        const { error, count } = await client().from("friendships")
          .update({ status: "accepted" }, { count: "exact" })
          .eq("requester_id", otherId).eq("addressee_id", id).eq("status", "pending");
        if (error) throw new Error(error.message);
        if (!count) throw new Error("No pending request from that person.");
        return true;
      },
      async removeFriendship(otherId) {
        const id = await currentAuthId();
        const { error } = await client().from("friendships").delete()
          .or(`and(requester_id.eq.${id},addressee_id.eq.${otherId}),and(requester_id.eq.${otherId},addressee_id.eq.${id})`);
        if (error) throw new Error(error.message);
        return true;
      },

      // ---------- SFC+ codes ----------
      // Redemption runs through a security-definer RPC (migration_003.sql):
      // it's the only path that can grant the SFC+ badge, so the client
      // never writes profiles.badges directly.
      async redeemCode(code) {
        const { error } = await client().rpc("redeem_sfc_plus_code", { p_code: code.trim() });
        if (error) throw new Error(error.message);
        return true;
      },
      // Relies on the "staff manage codes" policy: a non-staff caller gets
      // an empty result (blocked by RLS) rather than an error.
      async listCodes() {
        return must(await client().from("codes").select("*").order("created_at", { ascending: false }));
      },
      async createCode(code) {
        const id = await currentAuthId();
        const value = (code || "SFC-" + Math.random().toString(36).slice(2, 6).toUpperCase()
          + "-" + Math.random().toString(36).slice(2, 6).toUpperCase()).trim();
        return must(await client().from("codes")
          .insert({ code: value, created_by: id }).select().single());
      },
      // Covered by the "staff manage codes" FOR ALL policy.
      async deleteCode(code) {
        const { error } = await client().from("codes").delete().eq("code", code);
        if (error) throw new Error(friendlyError(error));
        return true;
      },
      // Badges can't be written from the client, so this goes through the
      // set_sfc_plus() security-definer RPC (migration_004.sql), which does
      // its own is_staff() check against the caller.
      async setSfcPlus(userId, on) {
        const { error } = await client().rpc("set_sfc_plus", { p_user: userId, p_on: on });
        if (error) throw new Error(friendlyError(error));
        return true;
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
