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
        '<button class="btn" id="data-seed" type="button">Reset to sample data</button>' +
        '<button class="btn danger" id="data-blank" type="button">Start blank</button>' +
        "</div></div>" +

        "</div>" +

        '<div class="card section-gap"><div class="card-title">About OpsDesk</div>' +
        '<p class="subtle">A one-person IT department: homelab inventory, a personal service desk with a knowledge base, ' +
        "double-entry books, a job-application funnel, and a study tracker — in one local-first app. " +
        "No server, no account, no build step: plain HTML, CSS, and JavaScript.</p>" +
        '<p class="hint" style="margin-top:8px">Data schema v' + esc(OD.db.version) + " · stored under the key <span class=\"mono\">opsdesk.v1</span></p>" +
        "</div>";

      /* wiring */
      el.querySelector("#set-save").addEventListener("click", function () {
        s.name = el.querySelector("#set-name").value.trim();
        s.theme = el.querySelector("#set-theme").value;
        OD.store.save();
        OD.app.applyTheme();
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
          title: "Reset to sample data?",
          message: "Everything you've entered is replaced by the demo homelab. Export a backup first if you care about the current data."
        }, function () {
          OD.store.resetToSeed();
          OD.app.applyTheme();
          OD.app.refresh();
          OD.ui.toast("Sample data restored.");
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
