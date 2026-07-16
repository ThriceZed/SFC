// ============================================================
// SFC shared runtime: chrome (nav/footer), auth modal,
// onboarding, toasts, and small render helpers. Included on
// every page. Page-specific logic lives in each HTML file.
// ============================================================

const UI = (() => {
  // ---------- helpers ----------
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const initials = (name) => (name || "?").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  // "@name" for a handle, or "" when blank, so a bare "@" never renders.
  // Tolerates the user typing the @ themselves.
  const handle = (v) => {
    const s = String(v ?? "").trim().replace(/^@+/, "");
    return s ? "@" + s : "";
  };

  // A null end_date means the creator marked it TBD.
  function fmtDateRange(a, b) {
    if (!a) return "Dates TBD";
    const opt = { month: "short", day: "numeric" };
    const full = { ...opt, year: "numeric" };
    const da = new Date(a + "T00:00:00");
    if (!b) return da.toLocaleDateString(undefined, full) + " – TBD";
    if (a === b) return da.toLocaleDateString(undefined, full);
    const db = new Date(b + "T00:00:00");
    return `${da.toLocaleDateString(undefined, opt)} – ${db.toLocaleDateString(undefined, full)}`;
  }
  const statusChip = (s) => ({
    recruiting: '<span class="chip green">● Recruiting</span>',
    full: '<span class="chip amber">Cast full</span>',
    wrapped: '<span class="chip gray">Wrapped</span>',
  }[s] || "");

  // ---------- toast ----------
  function toast(msg, type = "") {
    let wrap = document.querySelector(".toast-wrap");
    if (!wrap) { wrap = el("div", "toast-wrap"); document.body.appendChild(wrap); }
    const t = el("div", "toast " + type);
    t.innerHTML = (type === "ok" ? "✓ " : type === "err" ? "⚠ " : "") + esc(msg);
    wrap.appendChild(t);
    setTimeout(() => { t.style.opacity = "0"; t.style.transform = "translateY(10px)"; t.style.transition = "all .3s"; }, 2600);
    setTimeout(() => t.remove(), 3000);
  }
  function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

  // ---------- chrome ----------
  const PAGES = [
    { id: "home", href: "index.html", label: "Home", icon: "🎬" },
    { id: "search", href: "search.html", label: "Search", icon: "🔍" },
    { id: "create", href: "create.html", label: "Create", icon: "＋" },
    { id: "account", href: "account.html", label: "Account", icon: "👤" },
  ];

  async function mountChrome() {
    const active = document.body.dataset.page;
    const user = await SFC.getCurrentUser();

    // Signed-in users have no home page: it's a marketing page for visitors,
    // so drop it from both navs and point the brand at Search instead.
    const navPages = PAGES.filter((p) => p.id !== "account" && !(user && p.id === "home"));
    const homeHref = user ? "search.html" : "index.html";

    const nav = el("nav", "nav");
    nav.innerHTML = `
      <div class="container">
        <a class="brand" href="${homeHref}">
          <span class="logo">SFC</span> Student Film Connection
        </a>
        <div class="nav-links">
          ${navPages.map((p) =>
            `<a href="${p.href}" class="${p.id === active ? "active" : ""}">${p.label}</a>`).join("")}
        </div>
        <div class="nav-right">
          ${user
            ? `<button class="notif-btn" data-notif title="Notifications">🔔<span class="notif-badge" hidden>0</span></button>
               <a class="btn btn-ghost btn-sm" href="account.html">${esc(user.first_name || user.full_name?.split(" ")[0] || "Account")}</a>`
            : `<button class="btn btn-primary btn-sm" data-auth="login">Sign up</button>`}
        </div>
      </div>`;
    document.body.prepend(nav);
    const authBtn = nav.querySelector("[data-auth]");
    if (authBtn) authBtn.onclick = () => openAuth("signup");

    const mnav = el("nav", "mobile-nav");
    mnav.innerHTML = (user ? PAGES.filter((p) => p.id !== "home") : PAGES).map((p) =>
      `<a href="${p.href}" class="${p.id === active ? "active" : ""}"><span class="mi">${p.icon}</span>${p.label}</a>`).join("");
    document.body.appendChild(mnav);

    if (user) initNotifications(user, nav);
    mountFooter();
    observeReveals();
    return user;
  }

  function mountFooter() {
    const f = el("footer", "footer");
    f.innerHTML = `
      <div class="container">
        <div class="cols">
          <div>
            <div class="brand"><span class="logo" style="width:30px;height:30px;font-size:.8rem">SFC</span> Student Film Connection</div>
            <p>Find the crew, cast, and productions near you. Made by students, for students.</p>
          </div>
          <div>
            <strong style="display:block;margin-bottom:10px;font-family:'Space Grotesk'">Explore</strong>
            <div style="display:flex;flex-direction:column;gap:8px">
              <a href="search.html" class="soft">Browse productions</a>
              <a href="create.html" class="soft">Post a production</a>
              <a href="index.html#how" class="soft">How it works</a>
            </div>
          </div>
          <div>
            <strong style="display:block;margin-bottom:10px;font-family:'Space Grotesk'">Socials</strong>
            <p class="muted">Coming soon.</p>
          </div>
        </div>
        <div class="credit">
          <span>© ${new Date().getFullYear()} Student Film Connection</span>
          <span>Website by <a href="#" target="_blank" rel="noopener">ThriceZed</a></span>
        </div>
      </div>`;
    document.body.appendChild(f);
  }

  // ---------- notifications ----------
  // Two feeds merged: verdicts on applications I sent, and people applying
  // to productions I own. "Unread" is anything newer than the last time the
  // panel was opened, kept per-user in localStorage.
  const SEEN_KEY = (id) => `sfc.notifsSeen.${id}`;

  async function loadNotifications(user) {
    const items = [];

    const mine = await SFC.listUserApplications(user.id);
    for (const a of mine) {
      if (a.status === "pending") continue;
      const p = await SFC.getProduction(a.production_id);
      if (!p) continue;
      items.push({
        when: a.updated_at || a.created_at,
        icon: a.status === "accepted" ? "✅" : "📪",
        text: a.status === "accepted"
          ? `You're on the roster for <strong>${esc(p.title)}</strong>`
          : `<strong>${esc(p.title)}</strong> went another direction`,
        href: `production.html?id=${encodeURIComponent(p.id)}`,
      });
    }

    const prods = await SFC.listUserProductions(user.id);
    for (const p of prods) {
      const apps = await SFC.listApplicationsForProduction(p.id);
      const pending = apps.filter((a) => a.status === "pending");
      if (!pending.length) continue;
      const profs = await SFC.getProfiles(pending.map((a) => a.applicant_id));
      const byId = Object.fromEntries(profs.map((x) => [x.id, x]));
      for (const a of pending) {
        items.push({
          when: a.created_at,
          icon: "✋",
          text: `<strong>${esc(byId[a.applicant_id]?.full_name || "Someone")}</strong> applied to <strong>${esc(p.title)}</strong> as ${esc(a.role)}`,
          href: `production.html?id=${encodeURIComponent(p.id)}`,
        });
      }
    }

    items.sort((x, y) => new Date(y.when) - new Date(x.when));
    return items;
  }

  async function initNotifications(user, nav) {
    const btn = nav.querySelector("[data-notif]");
    if (!btn) return;
    const badge = btn.querySelector(".notif-badge");
    let items = [];
    try { items = await loadNotifications(user); } catch { return; }

    const seen = localStorage.getItem(SEEN_KEY(user.id));
    const unread = items.filter((i) => !seen || new Date(i.when) > new Date(seen));
    if (unread.length) {
      badge.textContent = unread.length > 9 ? "9+" : unread.length;
      badge.hidden = false;
    }

    btn.onclick = () => {
      localStorage.setItem(SEEN_KEY(user.id), new Date().toISOString());
      badge.hidden = true;
      const body = items.length
        ? items.map((i) => `
            <a class="notif-row" href="${i.href}">
              <span class="notif-ico">${i.icon}</span>
              <span class="notif-text">${i.text}
                <span class="notif-when">${timeAgo(i.when)}</span></span>
            </a>`).join("")
        : `<div class="empty" style="padding:36px 10px"><div class="ico">🔔</div>
             <p style="margin:0">Nothing yet. Apply to a production and you'll hear back here.</p></div>`;
      modal(`<div class="modal-head"><h2>Notifications</h2></div>
             <div class="modal-body" style="padding-top:0">${body}</div>`);
    };
  }

  function timeAgo(ts) {
    if (!ts) return "";
    const secs = (Date.now() - new Date(ts)) / 1000;
    const steps = [[60, "s"], [3600, "m"], [86400, "h"], [604800, "d"]];
    if (secs < 60) return "just now";
    for (let i = 1; i < steps.length; i++) {
      if (secs < steps[i][0]) return Math.floor(secs / steps[i - 1][0]) + steps[i][1] + " ago";
    }
    return Math.floor(secs / 604800) + "w ago";
  }

  // ---------- scroll reveal ----------
  function observeReveals() {
    const els = document.querySelectorAll(".reveal");
    if (!("IntersectionObserver" in window)) { els.forEach((e) => e.classList.add("in")); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
    }, { threshold: 0.12 });
    els.forEach((e) => io.observe(e));
  }

  // ---------- modal plumbing ----------
  function modal(innerHTML, { wide = false } = {}) {
    const backdrop = el("div", "modal-backdrop");
    backdrop.innerHTML = `<div class="modal-wrap"><div class="modal ${wide ? "wide" : ""}">
      <button class="modal-close" aria-label="Close">✕</button>${innerHTML}</div></div>`;
    document.body.appendChild(backdrop);
    requestAnimationFrame(() => backdrop.classList.add("open"));
    const close = () => { backdrop.classList.remove("open"); setTimeout(() => backdrop.remove(), 320); };
    backdrop.querySelector(".modal-close").onclick = close;
    backdrop.onclick = (e) => { if (e.target === backdrop) close(); };
    return { backdrop, close, q: (s) => backdrop.querySelector(s) };
  }

  // ---------- auth ----------
  const rolesHTML = (name, selected = []) => window.SFC_CONFIG.ROLES.map((r, i) => {
    const id = `${name}_${i}`;
    return `<input type="checkbox" id="${id}" value="${esc(r)}" ${selected.includes(r) ? "checked" : ""}>
            <label for="${id}">${esc(r)}</label>`;
  }).join("");

  function openAuth(mode = "login", onDone) {
    const expOpts = window.SFC_CONFIG.EXPERIENCE.map((e) =>
      `<option value="${e.id}">${e.label}</option>`).join("");
    const m = modal(`
      <div class="modal-head" style="padding-bottom:0">
        <h2 id="authTitle">Welcome to SFC</h2>
        <p class="muted" id="authSub" style="margin-top:-4px">Sign in to apply and post productions.</p>
      </div>
      <div class="seg">
        <button type="button" data-seg="login">Log in</button>
        <button type="button" data-seg="signup">Sign up</button>
      </div>
      <div class="modal-body">
        <form id="loginForm">
          <div class="field"><label>Email</label><input class="input" type="email" name="email" required placeholder="you@school.edu"></div>
          <div class="field"><label>Password</label><input class="input" type="password" name="password" required placeholder="••••••••"></div>
          <button class="btn btn-primary btn-block btn-lg" type="submit">Log in</button>
        </form>
        <form id="signupForm" style="display:none">
          <div class="row2">
            <div class="field"><label>First name</label><input class="input" name="first_name" required placeholder="Alex"></div>
            <div class="field"><label>Last name</label><input class="input" name="last_name" required placeholder="Rivera"></div>
          </div>
          <div class="field">
            <label>Username</label><input class="input" name="username" required placeholder="alexshoots">
            <div class="hint">Choose carefully: usernames can't be changed later.</div>
          </div>
          <div class="row2">
            <div class="field"><label>Email</label><input class="input" type="email" name="email" required placeholder="you@school.edu"></div>
            <div class="field"><label>Password</label><input class="input" type="password" name="password" required minlength="6" placeholder="6+ characters"></div>
          </div>
          <div class="field">
            <label class="switch"><input type="checkbox" name="is_group"><span class="track"></span>
              <span>I'm signing up as a group / club</span></label>
          </div>
          <div class="field" id="groupNameField" style="display:none">
            <label>Group name</label><input class="input" name="group_name" placeholder="Lens Collective">
          </div>
          <div class="field">
            <label>Roles you do</label>
            <div class="pill-select">${rolesHTML("suRoles")}</div>
          </div>
          <div class="row2">
            <div class="field"><label>Experience</label><select class="select" name="experience">${expOpts}</select></div>
            <div class="field"><label>Area / zip code</label><input class="input" name="area_code" placeholder="78701" required></div>
          </div>
          <div class="field"><label>Location</label><input class="input" name="location" placeholder="Austin, TX" required></div>
          <button class="btn btn-primary btn-block btn-lg" type="submit">Create account</button>
          <p class="hint center" style="margin-top:12px">Gear and contact details come next, in your profile.</p>
        </form>
      </div>`, { wide: true });

    const show = (which) => {
      m.q("#loginForm").style.display = which === "login" ? "" : "none";
      m.q("#signupForm").style.display = which === "signup" ? "" : "none";
      m.backdrop.querySelectorAll("[data-seg]").forEach((b) =>
        b.classList.toggle("active", b.dataset.seg === which));
      m.q("#authTitle").textContent = which === "login" ? "Welcome back" : "Join SFC";
      m.q("#authSub").textContent = which === "login"
        ? "Log in to apply and manage your productions."
        : "Set up your filmmaker profile. Takes a minute.";
    };
    m.backdrop.querySelectorAll("[data-seg]").forEach((b) => (b.onclick = () => show(b.dataset.seg)));
    show(mode);

    // group toggle
    m.q('[name="is_group"]').onchange = (e) => {
      m.q("#groupNameField").style.display = e.target.checked ? "" : "none";
    };

    // login submit
    m.q("#loginForm").onsubmit = async (e) => {
      e.preventDefault();
      const f = e.target;
      try {
        setBusy(f, true);
        await SFC.signIn(f.email.value.trim(), f.password.value);
        m.close(); toast("Signed in", "ok");
        onDone ? onDone() : location.reload();
      } catch (err) { toast(err.message, "err"); setBusy(f, false); }
    };

    // signup submit
    m.q("#signupForm").onsubmit = async (e) => {
      e.preventDefault();
      const f = e.target;
      const roles = [...f.querySelectorAll('.pill-select input:checked')].map((i) => i.value);
      const first = f.first_name.value.trim(), last = f.last_name.value.trim();
      const profile = {
        first_name: first, last_name: last,
        full_name: `${first} ${last}`.trim(),
        username: f.username.value.trim().replace(/\s+/g, "").toLowerCase(),
        is_group: f.is_group.checked,
        group_name: f.is_group.checked ? f.group_name.value.trim() : "",
        roles, experience: f.experience.value,
        area_code: f.area_code.value.trim(), location: f.location.value.trim(),
      };
      try {
        setBusy(f, true);
        await SFC.signUp(f.email.value.trim(), f.password.value, profile);
        m.close();
        openOnboarding(first);
      } catch (err) { toast(err.message, "err"); setBusy(f, false); }
    };
  }

  function setBusy(form, busy) {
    const btn = form.querySelector('button[type="submit"]');
    if (btn) { btn.disabled = busy; btn.dataset.label ??= btn.textContent; btn.textContent = busy ? "Working…" : btn.dataset.label; }
  }

  // ---------- onboarding (first popup after signup) ----------
  function openOnboarding(firstName) {
    const m = modal(`
      <div class="modal-head center">
        <div style="font-size:2.6rem;margin-bottom:6px">🎬</div>
        <h2>Welcome${firstName ? ", " + esc(firstName) : ""}!</h2>
        <p class="muted">Here's how Student Film Connection works.</p>
      </div>
      <div class="modal-body">
        <div style="display:flex;flex-direction:column;gap:18px;margin-bottom:22px">
          ${[
            ["🔍", "Browse nearby productions", "Films and shoots are sorted by how close they are to your area code."],
            ["✋", "Apply for a role", "Found something? Apply for the role you want, or as someone who's open to anything."],
            ["✅", "Get accepted & connect", "The creator reviews applicants and approves you. Then you swap contacts and shoot."],
          ].map(([i, h, p]) => `
            <div style="display:flex;gap:14px;align-items:flex-start">
              <div class="num-badge" style="margin:0;flex-shrink:0">${i}</div>
              <div><strong style="font-family:'Space Grotesk';display:block">${h}</strong>
              <span class="soft" style="font-size:.92rem">${p}</span></div>
            </div>`).join("")}
        </div>
        <a href="search.html" class="btn btn-primary btn-block btn-lg">Browse productions →</a>
        <a href="account.html" class="btn btn-block" style="margin-top:10px;color:var(--text-soft)">Finish my profile first</a>
      </div>`);
  }

  // ---------- profile viewer ----------
  // Contact details are only passed in once an applicant is on the roster;
  // callers omit `showContact` to keep them hidden.
  function openProfile(p, { showContact = false } = {}) {
    if (!p) return;
    const expLabel = (window.SFC_CONFIG.EXPERIENCE.find((e) => e.id === p.experience) || {}).label || p.experience || "";
    const roles = (p.roles || []).length
      ? p.roles.map((r) => `<span class="tag">${esc(r)}</span>`).join(" ")
      : '<span class="muted">No roles listed yet.</span>';
    const contactRows = [
      p.contact_email && `<div class="person-row"><span>✉️</span><a href="mailto:${esc(p.contact_email)}">${esc(p.contact_email)}</a></div>`,
      handle(p.contact_ig) && `<div class="person-row"><span>📷</span><span>${esc(handle(p.contact_ig))}</span></div>`,
      p.contact_phone && `<div class="person-row"><span>📱</span><span>${esc(p.contact_phone)}</span></div>`,
    ].filter(Boolean).join("");

    modal(`
      <div class="modal-head">
        <div style="display:flex;align-items:center;gap:14px">
          <div class="avatar" style="width:56px;height:56px;font-size:1.2rem">${initials(p.full_name)}</div>
          <div style="min-width:0">
            <h2 style="margin:0 0 2px">${esc(p.full_name || "Filmmaker")}</h2>
            <div class="muted" style="font-size:.9rem">
              ${esc(handle(p.username))}${p.location ? " · " + esc(p.location) : ""}
              ${p.is_group ? '<span class="chip blue" style="margin-left:6px">Group</span>' : ""}
            </div>
          </div>
        </div>
      </div>
      <div class="modal-body">
        ${p.bio ? `<p class="soft" style="margin-top:0;white-space:pre-wrap">${esc(p.bio)}</p>` : ""}
        <div class="field"><label>Roles</label><div style="display:flex;flex-wrap:wrap;gap:6px">${roles}</div></div>
        ${expLabel ? `<div class="field"><label>Experience</label><span class="chip">${esc(expLabel)}</span></div>` : ""}
        ${p.gear ? `<div class="field"><label>Gear</label><p class="soft" style="margin:0">${esc(p.gear)}</p></div>` : ""}
        ${showContact && contactRows
          ? `<hr class="divider"><strong style="font-family:'Space Grotesk'">Contact</strong>${contactRows}`
          : showContact ? '<hr class="divider"><p class="muted">No contact details listed.</p>' : ""}
      </div>`);
  }

  // ---------- require auth ----------
  async function requireAuth(action = "do that") {
    const u = await SFC.getCurrentUser();
    if (!u) { toast(`Sign in to ${action}.`); openAuth("login"); return null; }
    return u;
  }

  // ---------- production card ----------
  function prodCard(p) {
    const rolesText = p.open_to_any
      ? '<span class="chip blue">Open to any role</span>'
      : (p.roles_needed || []).slice(0, 3).map((r) =>
          `<span class="tag">${esc(r.role)}${r.count > 1 ? " ×" + r.count : ""}</span>`).join("")
        + ((p.roles_needed || []).length > 3 ? `<span class="tag">+${p.roles_needed.length - 3}</span>` : "");
    return `<a class="card card-hover prod-card reveal" href="production.html?id=${encodeURIComponent(p.id)}">
      <div class="banner"><span class="type-badge">${p.type === "shoot" ? "Single shoot" : "Film project"}</span></div>
      <div class="body">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
          <h3>${esc(p.title)}</h3>${statusChip(p.status)}
        </div>
        <p class="logline">${esc(p.logline)}</p>
        <div class="roles-row">${rolesText}</div>
        <div class="meta">
          <span class="chip">📍 ${esc(p.location)}</span>
          <span class="chip">📅 ${fmtDateRange(p.start_date, p.end_date)}</span>
          <span class="chip ${p.paid ? "green" : "gray"}">${p.paid ? "Paid" : "Unpaid"}</span>
        </div>
      </div>
    </a>`;
  }

  return { mountChrome, toast, openAuth, openOnboarding, requireAuth, modal,
           esc, initials, handle, timeAgo, fmtDateRange, statusChip, prodCard, rolesHTML,
           openProfile, observeReveals, el, setBusy };
})();
