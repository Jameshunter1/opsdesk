/* OpsDesk — cloud sync against YOUR OWN server (server/server.js).
   Local-first stays true: localStorage is the working copy and the app
   never waits on the network. Signed in, the whole workspace document
   syncs to your self-hosted SQLite row — pull on load/sign-in, debounced
   push on every change, honest conflict prompts when devices disagree.
   Plain fetch, no SDK, no third parties. */
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
    return { url: url };
  };
  cloud.saveConfig = function (url) {
    var clean = (url || "").trim().replace(/\/+$/, "");
    if (clean) writeJson(CFG_KEY, { url: clean });
    else writeJson(CFG_KEY, null);
  };
  cloud.configured = function () { return !!cloud.config().url; };

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
    return s ? s.email : "";
  };
  cloud.status = function () {
    return {
      configured: cloud.configured(),
      signedIn: cloud.signedIn(),
      email: cloud.email(),
      serverUrl: cloud.config().url,
      lastSync: meta().lastSync || "",
      dirty: state.dirty || meta().dirty === true,
      syncing: state.syncing,
      error: state.error
    };
  };

  /* ---------- HTTP ---------- */

  function http(method, path, body, withAuth) {
    var c = cloud.config();
    var headers = { "Content-Type": "application/json" };
    if (withAuth) {
      var s = session();
      if (!s) return Promise.reject(new Error("Not signed in."));
      headers.Authorization = "Bearer " + s.token;
    }
    return fetch(c.url + path, {
      method: method,
      headers: headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    }).then(function (res) {
      return res.text().then(function (txt) {
        var data = null;
        try { data = txt ? JSON.parse(txt) : null; } catch (e) { /* non-JSON */ }
        if (res.status === 401 && withAuth) {
          writeJson(SES_KEY, null);
          throw new Error("Session expired — sign in again.");
        }
        if (!res.ok) {
          throw new Error((data && data.error) || ("Server said HTTP " + res.status));
        }
        return data;
      });
    }, function () {
      throw new Error("Can't reach the server — is it running, and are you on the right network?");
    });
  }

  /* ---------- server + auth ---------- */

  cloud.checkServer = function (url) {
    var clean = (url || "").trim().replace(/\/+$/, "");
    return fetch(clean + "/api/health").then(function (res) {
      return res.json().then(function (d) {
        if (!d || !d.ok) throw new Error("bad");
        return d;
      });
    }).catch(function () {
      throw new Error("No OpsDesk server answered there. Check the address, that the server is running, and http vs https.");
    });
  };

  cloud.signUp = function (email, password) {
    return http("POST", "/api/signup", { email: email, password: password })
      .then(function (data) {
        writeJson(SES_KEY, { token: data.token, email: data.email, expiresAt: data.expiresAt });
        return cloud.afterSignIn();
      });
  };

  cloud.signIn = function (email, password) {
    return http("POST", "/api/signin", { email: email, password: password })
      .then(function (data) {
        writeJson(SES_KEY, { token: data.token, email: data.email, expiresAt: data.expiresAt });
        return cloud.afterSignIn();
      });
  };

  cloud.signOut = function () {
    http("POST", "/api/signout", {}, true).catch(function () { /* best effort */ });
    writeJson(SES_KEY, null);
    writeJson(META_KEY, null);
    state.dirty = false;
    state.error = "";
  };

  /* ---------- workspace ---------- */

  function fetchRemote() {
    return http("GET", "/api/workspace", undefined, true);
  }

  function pushDoc() {
    return http("PUT", "/api/workspace", { doc: OD.db }, true).then(function (data) {
      state.dirty = false;
      state.error = "";
      setMeta({ lastSync: OD.todayISO(), remoteUpdatedAt: (data && data.updatedAt) || "", dirty: false });
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
      '<button class="big-choice" data-pick="cloud" type="button"><b>Use my account\'s copy</b><span>Last saved to your server ' + OD.ui.esc(remote.updatedAt ? remote.updatedAt.slice(0, 10) : "") + " — replaces what's on this device</span></button>" +
      '<button class="big-choice" data-pick="local" type="button"><b>Keep this device\'s copy</b><span>Pushes it to your server, replacing the account version</span></button>' +
      "</div>" +
      '<div class="modal-actions"><button class="btn" data-pick="cancel" type="button">Cancel</button></div>', true
    );
    m.querySelectorAll("[data-pick]").forEach(function (b) {
      b.addEventListener("click", function () {
        var pick = b.getAttribute("data-pick");
        OD.ui.closeModal();
        if (pick === "cloud") { applyRemote(remote.doc); OD.ui.toast("Using your account's copy."); }
        else if (pick === "local") { pushDoc().then(function () { OD.ui.toast("This device's copy is now the account copy."); }).catch(fail); }
      });
    });
  }

  function fail(e) {
    state.syncing = false;
    state.error = e.message || "Sync failed.";
    OD.ui.toast("Sync: " + state.error, true);
    if (location.hash === "#/settings") OD.app.refresh();
  }

  /* ---------- sync orchestration ---------- */

  cloud.afterSignIn = function () {
    state.syncing = true;
    return fetchRemote().then(function (remote) {
      state.syncing = false;
      if (!remote || !remote.doc) return pushDoc().then(function () { OD.ui.toast("Account ready — this device's data now lives on your server too."); });
      if (!localLooksMeaningful()) { applyRemote(remote.doc); setMeta({ remoteUpdatedAt: remote.updatedAt }); OD.ui.toast("Pulled your data from your server."); return; }
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
      if (!remote || !remote.doc) { if (state.dirty || localLooksMeaningful()) schedulePush(); return; }
      var seen = meta().remoteUpdatedAt || "";
      var remoteNewer = remote.updatedAt && remote.updatedAt !== seen;
      if (remoteNewer && state.dirty) { conflictPrompt(remote); return; }
      if (remoteNewer) {
        applyRemote(remote.doc);
        setMeta({ remoteUpdatedAt: remote.updatedAt });
        OD.ui.toast("Synced from your server.");
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
