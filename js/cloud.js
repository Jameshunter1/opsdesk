/* OpsDesk — cloud sync (optional).
   Local-first stays true: localStorage is the working copy and the app
   never waits on the network. When an account is signed in, the whole
   workspace document syncs to a Supabase Postgres row that Row Level
   Security scopes to that user — pull on load/login, debounced push on
   every change, honest conflict prompts when two devices disagree.

   Talks to Supabase with plain fetch (auth + PostgREST) — no SDK, in
   keeping with the zero-dependency rule. */
(function () {
  "use strict";

  var CFG_KEY = "opsdesk.cloud.cfg";
  var SES_KEY = "opsdesk.cloud.session";
  var META_KEY = "opsdesk.cloud.meta";

  var cloud = OD.cloud = {};
  var applying = false;   // true while writing a remote doc into the app
  var pushTimer = null;
  var state = { syncing: false, error: "", dirty: false };

  /* ---------- little stores (outside the synced document on purpose) ---------- */

  function readJson(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; }
  }
  function writeJson(key, val) {
    try {
      if (val === null) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(val));
    } catch (e) { /* storage unavailable */ }
  }

  cloud.config = function () {
    var override = readJson(CFG_KEY);
    var base = window.OPSDESK_CLOUD || {};
    var url = ((override && override.url) || base.url || "").replace(/\/+$/, "");
    var key = (override && override.anonKey) || base.anonKey || "";
    return { url: url, anonKey: key };
  };
  cloud.saveConfig = function (url, anonKey) {
    writeJson(CFG_KEY, { url: (url || "").trim().replace(/\/+$/, ""), anonKey: (anonKey || "").trim() });
  };
  cloud.configured = function () {
    var c = cloud.config();
    return !!(c.url && c.anonKey);
  };

  function session() { return readJson(SES_KEY); }
  function meta() { return readJson(META_KEY) || {}; }
  function setMeta(patch) {
    var m = meta();
    Object.keys(patch).forEach(function (k) { m[k] = patch[k]; });
    writeJson(META_KEY, m);
  }

  cloud.signedIn = function () { return !!session(); };
  cloud.email = function () {
    var s = session();
    return s && s.user ? s.user.email : "";
  };
  cloud.status = function () {
    return {
      configured: cloud.configured(),
      signedIn: cloud.signedIn(),
      email: cloud.email(),
      lastSync: meta().lastSync || "",
      dirty: state.dirty || meta().dirty === true,
      syncing: state.syncing,
      error: state.error
    };
  };

  /* ---------- HTTP ---------- */

  function authHeaders(withUser) {
    var c = cloud.config();
    var h = { apikey: c.anonKey, "Content-Type": "application/json" };
    if (withUser) {
      var s = session();
      if (s) h.Authorization = "Bearer " + s.access_token;
    }
    return h;
  }

  function http(method, path, body, headers) {
    var c = cloud.config();
    return fetch(c.url + path, {
      method: method,
      headers: headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    }).then(function (res) {
      return res.text().then(function (txt) {
        var data = null;
        try { data = txt ? JSON.parse(txt) : null; } catch (e) { /* non-JSON */ }
        if (!res.ok) {
          var msg = (data && (data.msg || data.message || data.error_description || data.error)) || ("HTTP " + res.status);
          var err = new Error(msg);
          err.status = res.status;
          throw err;
        }
        return data;
      });
    });
  }

  function storeSession(data) {
    if (!data || !data.access_token) return null;
    var s = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Math.floor(Date.now() / 1000) + (data.expires_in || 3600) - 60,
      user: { id: data.user && data.user.id, email: data.user && data.user.email }
    };
    writeJson(SES_KEY, s);
    return s;
  }

  /* Refresh the access token when it's about to lapse. */
  function freshSession() {
    var s = session();
    if (!s) return Promise.reject(new Error("Not signed in."));
    if (s.expires_at > Math.floor(Date.now() / 1000)) return Promise.resolve(s);
    return http("POST", "/auth/v1/token?grant_type=refresh_token", { refresh_token: s.refresh_token }, authHeaders(false))
      .then(function (data) {
        var ns = storeSession(data);
        if (!ns) throw new Error("Session expired — sign in again.");
        return ns;
      })
      .catch(function (e) {
        writeJson(SES_KEY, null);
        throw new Error("Session expired — sign in again.");
      });
  }

  /* ---------- auth ---------- */

  cloud.signUp = function (email, password) {
    return http("POST", "/auth/v1/signup", { email: email, password: password }, authHeaders(false))
      .then(function (data) {
        if (data && data.access_token) {
          storeSession(data);
          return cloud.afterSignIn().then(function () { return { ok: true, needsConfirm: false }; });
        }
        // project has email confirmations on — account made, link sent
        return { ok: true, needsConfirm: true };
      });
  };

  cloud.signIn = function (email, password) {
    return http("POST", "/auth/v1/token?grant_type=password", { email: email, password: password }, authHeaders(false))
      .then(function (data) {
        if (!storeSession(data)) throw new Error("Sign-in failed.");
        return cloud.afterSignIn();
      });
  };

  cloud.signOut = function () {
    writeJson(SES_KEY, null);
    writeJson(META_KEY, null);
    state.dirty = false;
    state.error = "";
  };

  /* ---------- workspace row ---------- */

  function fetchRemote() {
    return freshSession().then(function () {
      return http("GET", "/rest/v1/workspaces?select=doc,updated_at", undefined, authHeaders(true));
    }).then(function (rows) {
      return rows && rows.length ? rows[0] : null;
    });
  }

  function pushDoc() {
    return freshSession().then(function () {
      var h = authHeaders(true);
      h.Prefer = "resolution=merge-duplicates,return=representation";
      return http("POST", "/rest/v1/workspaces?on_conflict=user_id",
        [{ doc: OD.db, updated_at: new Date().toISOString() }], h);
    }).then(function (rows) {
      var row = rows && rows.length ? rows[0] : null;
      state.dirty = false;
      setMeta({ lastSync: OD.todayISO(), remoteUpdatedAt: row ? row.updated_at : "", dirty: false });
      state.error = "";
    });
  }

  function applyRemote(doc) {
    applying = true;
    try {
      OD.store.importJson(JSON.stringify(doc));
      OD.app.applyTheme();
      OD.app.refresh();
    } finally {
      applying = false;
    }
    state.dirty = false;
    setMeta({ lastSync: OD.todayISO(), dirty: false });
  }

  function localLooksMeaningful() {
    var db = OD.db;
    return !!(db.tickets.length || db.workouts.length || db.fuelLogs.length ||
      db.studyLogs.length || db.projects.length || db.weighins.length ||
      Object.keys(db.habitChecks || {}).length);
  }

  function conflictPrompt(remote) {
    var m = OD.ui.openModal(
      OD.ui.modalHead("Two versions of your data") +
      '<p class="subtle">This device and your account both have changes. Which one wins? ' +
      "The other is overwritten — if unsure, Cancel and export a backup first.</p>" +
      '<div class="stack-choices" style="margin-top:12px">' +
      '<button class="big-choice" data-pick="cloud" type="button"><b>Use my account\'s copy</b><span>Last saved to the cloud ' + OD.ui.esc(remote.updated_at ? remote.updated_at.slice(0, 10) : "") + " — replaces what's on this device</span></button>" +
      '<button class="big-choice" data-pick="local" type="button"><b>Keep this device\'s copy</b><span>Pushes it to your account, replacing the cloud version</span></button>' +
      "</div>" +
      '<div class="modal-actions"><button class="btn" data-pick="cancel" type="button">Cancel</button></div>', true
    );
    m.querySelectorAll("[data-pick]").forEach(function (b) {
      b.addEventListener("click", function () {
        var pick = b.getAttribute("data-pick");
        OD.ui.closeModal();
        if (pick === "cloud") { applyRemote(remote.doc); OD.ui.toast("Using your account's copy."); }
        else if (pick === "local") { pushDoc().then(function () { OD.ui.toast("This device's copy is now the cloud copy."); }).catch(fail); }
      });
    });
  }

  function fail(e) {
    state.syncing = false;
    state.error = e.message || "Sync failed.";
    OD.ui.toast("Cloud: " + state.error, true);
    if (location.hash === "#/settings") OD.app.refresh();
  }

  /* ---------- sync orchestration ---------- */

  cloud.afterSignIn = function () {
    state.syncing = true;
    return fetchRemote().then(function (remote) {
      state.syncing = false;
      if (!remote) return pushDoc().then(function () { OD.ui.toast("Account ready — this device's data is now backed by the cloud."); });
      if (!localLooksMeaningful()) { applyRemote(remote.doc); OD.ui.toast("Pulled your data from the cloud."); return; }
      conflictPrompt(remote);
    }).catch(function (e) { fail(e); throw e; });
  };

  /* Called on app start when already signed in: pick up other devices' pushes. */
  cloud.init = function () {
    if (!cloud.configured() || !cloud.signedIn()) return;
    state.dirty = meta().dirty === true;
    state.syncing = true;
    fetchRemote().then(function (remote) {
      state.syncing = false;
      if (!remote) { if (state.dirty || localLooksMeaningful()) schedulePush(); return; }
      var seen = meta().remoteUpdatedAt || "";
      var remoteNewer = remote.updated_at && remote.updated_at !== seen;
      if (remoteNewer && state.dirty) { conflictPrompt(remote); return; }
      if (remoteNewer) {
        applyRemote(remote.doc);
        setMeta({ remoteUpdatedAt: remote.updated_at });
        OD.ui.toast("Synced from your account.");
        return;
      }
      if (state.dirty) schedulePush();
    }).catch(function (e) {
      state.syncing = false;
      state.error = e.message || "offline";
      // offline is fine — local-first means we just carry on
    });
  };

  function schedulePush() {
    clearTimeout(pushTimer);
    pushTimer = setTimeout(function () {
      state.syncing = true;
      pushDoc().then(function () {
        state.syncing = false;
        if (location.hash === "#/settings") OD.app.refresh();
      }).catch(function (e) {
        state.syncing = false;
        state.error = e.message || "offline";
        // stay dirty; retried on next change or Sync now
      });
    }, 2000);
  }

  /* Store hook: every local save marks dirty and schedules a push. */
  cloud.onLocalChange = function () {
    if (applying || !cloud.configured() || !cloud.signedIn()) return;
    state.dirty = true;
    setMeta({ dirty: true });
    schedulePush();
  };

  cloud.syncNow = function () {
    if (!cloud.signedIn()) return Promise.reject(new Error("Not signed in."));
    clearTimeout(pushTimer);
    state.syncing = true;
    return pushDoc().then(function () {
      state.syncing = false;
      OD.ui.toast("Synced.");
    }).catch(function (e) { fail(e); throw e; });
  };

  // retry a pending push when the connection returns
  window.addEventListener("online", function () {
    if (cloud.signedIn() && (state.dirty || meta().dirty)) schedulePush();
  });
})();
