# SFC: Student Film Connection

Find student filmmakers nearby to crew and cast your next shoot. Browse productions, apply for a role, get accepted.

Static site (plain HTML/CSS/JS, no build step) with [Supabase](https://supabase.com) for auth and data.

## Running locally

No build step. Serve the folder over HTTP (needed so the browser treats it as a real origin):

```bash
python3 -m http.server 5501
# open http://127.0.0.1:5501
```

## Demo mode vs live mode

The site ships in **demo mode**: accounts and productions live in your browser's
`localStorage`, seeded from `js/seed.js`. Nothing is shared between browsers.
This lets you click through the entire experience with no backend.

It flips to **live mode** automatically once real Supabase credentials are set.
Everything else in the app is identical; `js/store.js` exposes one async API with
two backends behind it.

### Going live

1. Create a free project at [supabase.com](https://supabase.com).
2. In the project's **SQL Editor**, run the contents of `supabase/schema.sql`.
   This creates the `profiles`, `productions`, and `applications` tables and
   their row-level security policies.
3. In **Project Settings → API**, copy the **Project URL** and the **anon/public** key.
4. Paste both into `js/config.js`:

   ```js
   window.SFC_CONFIG = {
     SUPABASE_URL: "https://xxxxx.supabase.co",
     SUPABASE_ANON_KEY: "eyJ...",
     ...
   };
   ```

5. Reload. The site is now backed by a real shared database.

The anon key is safe to commit: it is a public client key, and row-level security
in `schema.sql` is what actually enforces access. Never commit the **service_role** key.

## Layout

```
index.html          Home: notable productions, how it works, about
search.html         Browse + filter, sorted by proximity to area code
create.html         Post a production (film project or single shoot)
production.html     Detail page: apply, and the owner's applicant roster
account.html        Profile, my productions, my applications
css/styles.css      Design system (light theme, blue accent)
js/config.js        Supabase credentials + shared role/experience lists
js/store.js         Data layer: demo (localStorage) or live (Supabase)
js/app.js           Shared chrome: nav, footer, auth modal, onboarding, toasts
js/seed.js          Demo seed data
supabase/schema.sql Tables, RLS policies, indexes
```

## Deploying

Any static host works. For GitHub Pages: push to GitHub, then
**Settings → Pages → Deploy from branch → `main` / root**.

---

Website by [ThriceZed](https://github.com/ThriceZed).
