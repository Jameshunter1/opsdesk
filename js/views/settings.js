/* OpsDesk — Settings: identity, theme, and data in/out.
   All data lives in this browser's localStorage; export is the backup. */
(function () {
  "use strict";

  var esc = function (s) { return OD.ui.esc(s); };

  OD.views.settings = {
    title: "Settings",
    actions: function () { return []; },

    render: function (el) {
      var s = OD.db.settings;

      var moduleDefs = [
        { key: "tasks", why: "projects with next actions, loose to-dos, and your solved-it notes" },
        { key: "fitness", why: "workouts, weekly routine, weigh-ins, PRs" },
        { key: "fuel", why: "calorie plan, daily macros, supplements" },
        { key: "study", why: "study plans, daily target, drills" },
        { key: "lab", why: "homelab: VMs, networks, firewall rules (IT folks)" }
      ];
      var moduleChecks = moduleDefs.map(function (m) {
        var on = OD.moduleOn(m.key);
        return '<label class="row" style="gap:8px;align-items:baseline">' +
          '<input type="checkbox" data-module="' + m.key + '"' + (on ? " checked" : "") + ">" +
          "<span><b>" + esc(OD.viewLabel(m.key)) + '</b> <span class="hint">— ' + esc(m.why) + "</span></span></label>";
      }).join("");

      /* account & sync */
      var cs = OD.cloud.status();
      var accountCard = '<div class="card"><div class="card-title">Account & sync</div>';
      if (!cs.configured) {
        accountCard +=
          '<p class="subtle">Optional: connect a free Supabase project and your data follows you to any device you sign in on. Local-only works forever without it.</p>' +
          '<p class="hint" style="margin:8px 0 12px">Setup takes ~5 minutes — see the <a href="https://github.com/Jameshunter1/opsdesk/blob/main/docs/guide.md#use-it-on-all-your-devices-account--sync" target="_blank" rel="noopener">guide</a>, then paste the two values from Project Settings → API:</p>' +
          '<div class="stack">' +
          '<div class="field"><label for="cloud-url">Project URL</label><input class="control" id="cloud-url" placeholder="https://xxxx.supabase.co"></div>' +
          '<div class="field"><label for="cloud-key">Anon public key</label><input class="control" id="cloud-key" placeholder="eyJhbGciOi…"></div>' +
          '<div><button class="btn primary" id="cloud-save-cfg" type="button">Connect</button></div>' +
          "</div>";
      } else if (!cs.signedIn) {
        accountCard +=
          '<p class="subtle">Sign in and this device syncs with your account — or create the account first (same form, other button).</p>' +
          '<div class="stack" style="margin-top:10px">' +
          '<div class="field"><label for="cloud-email">Email</label><input class="control" id="cloud-email" type="email" autocomplete="email"></div>' +
          '<div class="field"><label for="cloud-pass">Password</label><input class="control" id="cloud-pass" type="password" autocomplete="current-password"></div>' +
          '<div class="row"><button class="btn primary" id="cloud-signin" type="button">Sign in</button>' +
          '<button class="btn" id="cloud-signup" type="button">Create account</button>' +
          '<button class="btn ghost" id="cloud-chg-server" type="button">Change server</button></div>' +
          (cs.error ? '<p class="form-error">' + esc(cs.error) + "</p>" : "") +
          "</div>";
      } else {
        accountCard +=
          '<p class="subtle">Signed in as <b>' + esc(cs.email) + "</b>.</p>" +
          '<p class="hint" style="margin:8px 0 12px">' +
          (cs.syncing ? "Syncing…" : cs.dirty ? "Changes waiting to sync" : "Everything synced") +
          (cs.lastSync ? " · last sync " + esc(OD.fmt.dateFull(cs.lastSync)) : "") +
          (cs.error ? ' · <span style="color:var(--critical)">' + esc(cs.error) + "</span>" : "") + "</p>" +
          '<div class="row"><button class="btn" id="cloud-sync-now" type="button">Sync now</button>' +
          '<button class="btn ghost" id="cloud-signout" type="button">Sign out</button></div>' +
          '<p class="hint" style="margin-top:10px">Sign out keeps this device\'s data; it just stops syncing.</p>';
      }
      accountCard += "</div>";

      el.innerHTML =
        '<div class="grid grid-2">' +

        accountCard +

        '<div class="card"><div class="card-title">Profile & appearance</div>' +
        '<div class="stack">' +
        '<div class="field"><label for="set-name">Your name</label>' +
        '<input class="control" id="set-name" value="' + esc(s.name) + '" placeholder="James"></div>' +
        '<div class="field"><label for="set-theme">Theme</label>' +
        '<select class="control" id="set-theme">' +
        '<option value="auto"' + (s.theme === "auto" ? " selected" : "") + ">System</option>" +
        '<option value="light"' + (s.theme === "light" ? " selected" : "") + ">Light</option>" +
        '<option value="dark"' + (s.theme === "dark" ? " selected" : "") + ">Dark</option>" +
        "</select></div>" +
        '<div><button class="btn primary" id="set-save" type="button">Save</button></div>' +
        "</div></div>" +

        '<div class="card"><div class="card-title">Experience</div>' +
        '<div class="stack">' +
        '<div class="field"><label for="set-mode">How should things be worded?</label>' +
        '<select class="control" id="set-mode">' +
        '<option value="simple"' + (s.mode === "simple" ? " selected" : "") + ">Simple — plain everyday language</option>" +
        '<option value="pro"' + (s.mode !== "simple" ? " selected" : "") + ">Pro — ops terms (tickets, modules, the lab)</option>" +
        "</select>" +
        '<span class="hint">Same data underneath either way — switch freely.</span></div>' +
        '<div class="field"><label for="set-green">What keeps a day green? (extends streaks, bends the curve)</label>' +
        '<select class="control" id="set-green">' +
        '<option value="0.5"' + (OD.goals.greenBar() === 0.5 ? " selected" : "") + ">Showing up — 50% of points</option>" +
        '<option value="0.75"' + (OD.goals.greenBar() === 0.75 ? " selected" : "") + ">Solid — 75% of points</option>" +
        '<option value="1"' + (OD.goals.greenBar() === 1 ? " selected" : "") + ">All or nothing — 100%</option>" +
        "</select></div>" +
        '<div class="field"><label>What do you want to track?</label>' + moduleChecks + "</div>" +
        "</div></div>" +

        '<div class="card"><div class="card-title">Your data</div>' +
        '<p class="subtle">Everything lives in this browser’s local storage — nothing leaves your machine. ' +
        "Export a JSON backup before clearing browser data or moving computers.</p>" +
        '<p class="hint" style="margin-top:8px">Last backup: <b>' + esc(s.lastBackup ? OD.fmt.dateFull(s.lastBackup) : "never") + "</b></p>" +
        '<div class="row" style="margin-top:12px">' +
        '<button class="btn" id="data-export" type="button">Export backup</button>' +
        '<button class="btn" id="data-import" type="button">Import backup</button>' +
        '<input type="file" id="data-file" accept="application/json" hidden>' +
        "</div>" +
        '<div class="card-title" style="margin-top:20px">Danger zone</div>' +
        '<div class="row">' +
        '<button class="btn" id="data-seed" type="button">Load IT demo data</button>' +
        '<button class="btn" id="data-simple" type="button">Load simple starter</button>' +
        '<button class="btn danger" id="data-blank" type="button">Start blank</button>' +
        "</div></div>" +

        "</div>" +

        '<div class="card section-gap"><div class="card-title">About OpsDesk</div>' +
        '<p class="subtle">Your goals, run like ops: tasks and projects, training, food and supplements, and study plans — ' +
        "scored automatically on the 1%-better-per-day theory. " +
        "Local-first, zero dependencies, no build step — with an optional account that syncs your data across devices.</p>" +
        '<p class="hint" style="margin-top:8px">OpsDesk v' + esc(OD.VERSION) + " · data schema v" + esc(OD.db.version) + " · stored under the key <span class=\"mono\">opsdesk.v1</span> · " +
        '<span class="kbd">Ctrl K</span> searches everything</p>' +
        "</div>";

      /* wiring — account & sync */
      var saveCfg = el.querySelector("#cloud-save-cfg");
      if (saveCfg) saveCfg.addEventListener("click", function () {
        var url = el.querySelector("#cloud-url").value.trim();
        var key = el.querySelector("#cloud-key").value.trim();
        if (!/^https:\/\/.+/.test(url) || key.length < 20) {
          OD.ui.toast("That doesn't look right — check both values against Project Settings → API.", true);
          return;
        }
        OD.cloud.saveConfig(url, key);
        OD.app.refresh();
        OD.ui.toast("Connected — now sign in or create your account.");
      });

      function authCall(fn, btn) {
        var email = el.querySelector("#cloud-email").value.trim();
        var pass = el.querySelector("#cloud-pass").value;
        if (!email || pass.length < 8) {
          OD.ui.toast("Enter your email and a password of at least 8 characters.", true);
          return;
        }
        btn.disabled = true;
        fn(email, pass).then(function (res) {
          if (res && res.needsConfirm) {
            OD.ui.toast("Account created — confirm the email Supabase sent you, then sign in.");
            OD.app.refresh();
          } else {
            OD.app.refresh();
          }
        }).catch(function (e) {
          btn.disabled = false;
          OD.ui.toast(e.message || "That didn't work.", true);
        });
      }
      var signin = el.querySelector("#cloud-signin");
      if (signin) signin.addEventListener("click", function () { authCall(OD.cloud.signIn, signin); });
      var signup = el.querySelector("#cloud-signup");
      if (signup) signup.addEventListener("click", function () { authCall(OD.cloud.signUp, signup); });
      var chgServer = el.querySelector("#cloud-chg-server");
      if (chgServer) chgServer.addEventListener("click", function () {
        OD.ui.confirm({ title: "Change server?", message: "Clears the saved server settings on this device (your data stays).", confirmLabel: "Change", danger: false }, function () {
          OD.cloud.saveConfig("", "");
          try { localStorage.removeItem("opsdesk.cloud.cfg"); } catch (e) { /* fine */ }
          OD.app.refresh();
        });
      });
      var syncNow = el.querySelector("#cloud-sync-now");
      if (syncNow) syncNow.addEventListener("click", function () {
        syncNow.disabled = true;
        OD.cloud.syncNow().then(function () { OD.app.refresh(); }).catch(function () { syncNow.disabled = false; });
      });
      var signout = el.querySelector("#cloud-signout");
      if (signout) signout.addEventListener("click", function () {
        OD.cloud.signOut();
        OD.app.refresh();
        OD.ui.toast("Signed out — this device keeps its data.");
      });

      /* wiring */
      el.querySelector("#set-save").addEventListener("click", function () {
        s.name = el.querySelector("#set-name").value.trim();
        s.theme = el.querySelector("#set-theme").value;
        s.mode = el.querySelector("#set-mode").value;
        s.greenThreshold = Number(el.querySelector("#set-green").value) || 0.5;
        s.modules = s.modules || {};
        el.querySelectorAll("[data-module]").forEach(function (cb) {
          s.modules[cb.getAttribute("data-module")] = cb.checked;
        });
        OD.store.save();
        OD.app.applyTheme();
        OD.app.refresh();
        OD.ui.toast("Settings saved.");
      });

      el.querySelector("#data-export").addEventListener("click", function () {
        OD.store.exportJson();
        OD.ui.toast("Backup downloaded.");
      });

      var fileInput = el.querySelector("#data-file");
      el.querySelector("#data-import").addEventListener("click", function () { fileInput.click(); });
      fileInput.addEventListener("change", function () {
        var f = fileInput.files[0];
        if (!f) return;
        var reader = new FileReader();
        reader.onload = function () {
          OD.ui.confirm({
            title: "Import backup?",
            message: "This replaces everything currently in OpsDesk with the contents of " + f.name + ".",
            confirmLabel: "Import", danger: false
          }, function () {
            try {
              OD.store.importJson(String(reader.result));
              OD.app.applyTheme();
              OD.app.refresh();
              OD.ui.toast("Backup imported.");
            } catch (e) {
              OD.ui.toast(e.message || "Import failed.", true);
            }
          });
        };
        reader.readAsText(f);
        fileInput.value = "";
      });

      el.querySelector("#data-seed").addEventListener("click", function () {
        OD.ui.confirm({
          title: "Load the IT demo?",
          message: "Everything you've entered is replaced by the demo homelab (Pro mode). Export a backup first if you care about the current data."
        }, function () {
          OD.store.resetToSeed();
          OD.app.applyTheme();
          OD.app.refresh();
          OD.ui.toast("Demo homelab loaded.");
        });
      });

      el.querySelector("#data-simple").addEventListener("click", function () {
        OD.ui.confirm({
          title: "Load the simple starter?",
          message: "Everything you've entered is replaced by the everyday starter (Simple mode). Export a backup first if you care about the current data."
        }, function () {
          OD.store.resetToSimple(s.name);
          OD.app.applyTheme();
          OD.app.refresh();
          OD.ui.toast("Simple starter loaded.");
        });
      });

      el.querySelector("#data-blank").addEventListener("click", function () {
        OD.ui.confirm({
          title: "Start blank?",
          message: "Everything is wiped and you get an empty workspace. Export a backup first if you care about the current data."
        }, function () {
          OD.store.startBlank();
          OD.app.applyTheme();
          OD.app.refresh();
          OD.ui.toast("Fresh workspace ready.");
        });
      });
    }
  };
})();
