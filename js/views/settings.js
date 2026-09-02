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
        { key: "projects", why: "outcomes broken into steps, always showing the next one" },
        { key: "fitness", why: "workouts, weekly routine, weigh-ins, PRs" },
        { key: "fuel", why: "calorie plan, daily macros, supplements" },
        { key: "study", why: "daily study target, courses, certificates" },
        { key: "desk", why: "to-dos, problems, and what you learned fixing them" },
        { key: "ledger", why: "money in and out" },
        { key: "pipeline", why: "job applications and follow-ups" },
        { key: "lab", why: "homelab: VMs, networks, firewall rules (IT folks)" }
      ];
      var moduleChecks = moduleDefs.map(function (m) {
        var on = OD.moduleOn(m.key);
        return '<label class="row" style="gap:8px;align-items:baseline">' +
          '<input type="checkbox" data-module="' + m.key + '"' + (on ? " checked" : "") + ">" +
          "<span><b>" + esc(OD.viewLabel(m.key)) + '</b> <span class="hint">— ' + esc(m.why) + "</span></span></label>";
      }).join("");

      el.innerHTML =
        '<div class="grid grid-2">' +

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
        '<option value="pro"' + (s.mode !== "simple" ? " selected" : "") + ">Pro — IT-department terms (tickets, ledger, debits)</option>" +
        "</select>" +
        '<span class="hint">Same data underneath either way — switch freely.</span></div>' +
        '<div class="field"><label>What do you want to track?</label>' + moduleChecks + "</div>" +
        "</div></div>" +

        '<div class="card"><div class="card-title">Your data</div>' +
        '<p class="subtle">Everything lives in this browser’s local storage — nothing leaves your machine. ' +
        "Export a JSON backup before clearing browser data or moving computers.</p>" +
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
        '<p class="subtle">A one-person IT department: homelab inventory, a personal service desk with a knowledge base, ' +
        "double-entry books, a job-application funnel, and a study tracker — in one local-first app. " +
        "No server, no account, no build step: plain HTML, CSS, and JavaScript.</p>" +
        '<p class="hint" style="margin-top:8px">OpsDesk v' + esc(OD.VERSION) + " · data schema v" + esc(OD.db.version) + " · stored under the key <span class=\"mono\">opsdesk.v1</span> · " +
        '<span class="kbd">Ctrl K</span> searches everything</p>' +
        "</div>";

      /* wiring */
      el.querySelector("#set-save").addEventListener("click", function () {
        s.name = el.querySelector("#set-name").value.trim();
        s.theme = el.querySelector("#set-theme").value;
        s.mode = el.querySelector("#set-mode").value;
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
