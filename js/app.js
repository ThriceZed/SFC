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
  function fmtDateRange(a, b) {
    const opt = { month: "short", day: "numeric" };
    const da = new Date(a + "T00:00:00"), db = new Date(b + "T00:00:00");
    if (!a) return "Dates TBD";
    if (a === b || !b) return da.toLocaleDateString(undefined, { ...opt, year: "numeric" });
    const sameYear = da.getFullYear() === db.getFullYear();
    return `${da.toLocaleDateString(undefined, opt)} – ${db.toLocaleDateString(undefined, { ...opt, year: "numeric" })}`;
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

    // top nav
    const nav = el("nav", "nav");
    nav.innerHTML = `
      <div class="container">
        <a class="brand" href="index.html">
          <span class="logo">SFC</span> Student Film Connection
        </a>
        <div class="nav-links">
          ${PAGES.filter((p) => p.id !== "account").map((p) =>
            `<a href="${p.href}" class="${p.id === active ? "active" : ""}">${p.label}</a>`).join("")}
        </div>
        <div class="nav-right">
          ${user
            ? `<a class="btn btn-ghost btn-sm" href="account.html">${esc(user.full_name?.split(" ")[0] || "Account")}</a>`
            : `<button class="btn btn-primary btn-sm" data-auth="login">Sign up</button>`}
        </div>
      </div>`;
    document.body.prepend(nav);
    const authBtn = nav.querySelector("[data-auth]");
    if (authBtn) authBtn.onclick = () => openAuth("signup");

    // mobile bottom nav
    const mnav = el("nav", "mobile-nav");
    mnav.innerHTML = PAGES.map((p) =>
      `<a href="${p.href}" class="${p.id === active ? "active" : ""}"><span class="mi">${p.icon}</span>${p.label}</a>`).join("");
    document.body.appendChild(mnav);

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
            <div class="field"><label>Full name</label><input class="input" name="full_name" required placeholder="Alex Rivera"></div>
            <div class="field"><label>Username</label><input class="input" name="username" required placeholder="alexshoots"></div>
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
          <div class="field"><label>Gear you own <span class="muted">(optional)</span></label>
            <input class="input" name="gear" placeholder="Camera, lenses, lights…"></div>
          <div class="row2">
            <div class="field"><label>Instagram <span class="muted">(optional)</span></label><input class="input" name="contact_ig" placeholder="@handle"></div>
            <div class="field"><label>Phone <span class="muted">(optional)</span></label><input class="input" name="contact_phone" placeholder="(optional)"></div>
          </div>
          <button class="btn btn-primary btn-block btn-lg" type="submit">Create account</button>
          <p class="hint center" style="margin-top:12px">By signing up you can browse, apply, and post shoots.</p>
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
      const profile = {
        full_name: f.full_name.value.trim(),
        username: f.username.value.trim().replace(/\s+/g, "").toLowerCase(),
        is_group: f.is_group.checked,
        group_name: f.is_group.checked ? f.group_name.value.trim() : "",
        roles, experience: f.experience.value,
        area_code: f.area_code.value.trim(), location: f.location.value.trim(),
        gear: f.gear.value.trim(), bio: "",
        contact_ig: f.contact_ig.value.trim(), contact_phone: f.contact_phone.value.trim(),
      };
      try {
        setBusy(f, true);
        await SFC.signUp(f.email.value.trim(), f.password.value, profile);
        m.close();
        openOnboarding(profile.full_name.split(" ")[0]);
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
            ["✋", "Apply for a role", "Found something? Apply for the role you want, or as open-to-anything."],
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
           esc, initials, fmtDateRange, statusChip, prodCard, rolesHTML, observeReveals, el, setBusy };
})();
