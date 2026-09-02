/* OpsDesk — Study: curriculum modules, cert tracker, and the command vault
   ("commands I know cold") with a drill mode to keep them cold. */
(function () {
  "use strict";

  var esc = function (s) { return OD.ui.esc(s); };

  var search = "";

  var MOD_TONE = { todo: "plain", active: "accent", done: "good" };
  var CERT_TONE = { planned: "plain", studying: "accent", scheduled: "warning", passed: "good" };

  function moduleForm(m) {
    OD.ui.form({
      title: m ? "Edit module" : "New module",
      values: m,
      fields: [
        { key: "name", label: "Module name", required: true, span2: true, placeholder: "Module 2 — TLS & internal CA" },
        { key: "status", label: "Status", type: "select", options: OD.enums.moduleStatus },
        { key: "hours", label: "Hours logged", type: "number", step: "0.5" },
        { key: "topics", label: "Topics", span2: true, placeholder: "What this module covers" },
        { key: "proof", label: "Proof of work", span2: true, placeholder: "The demonstrable thing that says it's done" },
        { key: "notes", label: "Notes", type: "textarea", span2: true }
      ],
      onSubmit: function (v) {
        if (m) Object.assign(m, v);
        else { v.id = OD.uid(); OD.db.modules.push(v); }
        OD.store.save();
        OD.app.refresh();
        OD.ui.toast(m ? "Module updated." : "Module added.");
      },
      onDelete: m && function () {
        OD.ui.confirm({ title: "Delete module?", message: m.name }, function () {
          OD.db.modules = OD.db.modules.filter(function (x) { return x.id !== m.id; });
          OD.store.save();
          OD.app.refresh();
        });
      }
    });
  }

  function certForm(c) {
    OD.ui.form({
      title: c ? "Edit certification" : "New certification",
      values: c,
      fields: [
        { key: "name", label: "Certification", required: true, placeholder: "CompTIA Network+" },
        { key: "status", label: "Status", type: "select", options: OD.enums.certStatus },
        { key: "date", label: "Exam / target date", type: "date" }
      ],
      onSubmit: function (v) {
        if (c) Object.assign(c, v);
        else { v.id = OD.uid(); OD.db.certs.push(v); }
        OD.store.save();
        OD.app.refresh();
      },
      onDelete: c && function () {
        OD.ui.confirm({ title: "Delete certification?", message: c.name }, function () {
          OD.db.certs = OD.db.certs.filter(function (x) { return x.id !== c.id; });
          OD.store.save();
          OD.app.refresh();
        });
      }
    });
  }

  function commandForm(c) {
    OD.ui.form({
      title: c ? "Edit command" : "Add to the vault",
      values: c,
      fields: [
        { key: "cmd", label: "Command", required: true, span2: true, placeholder: "journalctl -u ssh" },
        { key: "what", label: "What it does", required: true, span2: true, placeholder: "Why a service isn't running" }
      ],
      onSubmit: function (v) {
        if (c) Object.assign(c, v);
        else { v.id = OD.uid(); OD.db.commands.push(v); }
        OD.store.save();
        OD.app.refresh();
      },
      onDelete: c && function () {
        OD.ui.confirm({ title: "Remove command?", message: c.cmd }, function () {
          OD.db.commands = OD.db.commands.filter(function (x) { return x.id !== c.id; });
          OD.store.save();
          OD.app.refresh();
        });
      }
    });
  }

  /* Drill mode — prompt with the description, recall the command. */
  function drill() {
    var deck = OD.db.commands.slice();
    if (!deck.length) {
      OD.ui.toast("The vault is empty — add a command first.", true);
      return;
    }
    for (var i = deck.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = deck[i]; deck[i] = deck[j]; deck[j] = tmp;
    }
    var idx = 0, revealed = false;

    var m = OD.ui.openModal(OD.ui.modalHead("Command drill") + '<div id="drill-body"></div>', true);
    var body = m.querySelector("#drill-body");

    function draw() {
      var c = deck[idx];
      body.innerHTML =
        '<div class="flash">' +
        '<div class="flash-q">' + esc(c.what) + "</div>" +
        (revealed ? '<div class="flash-a">' + esc(c.cmd) + "</div>" : "") +
        "</div>" +
        '<p class="hint" style="text-align:center;margin-top:8px">' + (idx + 1) + " of " + deck.length + "</p>" +
        '<div class="modal-actions" style="justify-content:center">' +
        (revealed
          ? '<button class="btn primary" data-act="next" type="button">' + (idx + 1 < deck.length ? "Next →" : "Finish") + "</button>"
          : '<button class="btn primary" data-act="reveal" type="button">Show the command</button>') +
        "</div>";

      var btn = body.querySelector("[data-act]");
      btn.focus();
      btn.addEventListener("click", function () {
        if (!revealed) { revealed = true; draw(); return; }
        if (idx + 1 < deck.length) { idx++; revealed = false; draw(); }
        else { OD.ui.closeModal(); OD.ui.toast("Drill done — " + deck.length + " commands, still cold."); }
      });
    }
    draw();
  }

  OD.views.study = {
    title: "Study",
    actions: function () {
      return [
        { label: "Drill", onClick: drill },
        { label: "+ Module", primary: true, onClick: function () { moduleForm(null); } }
      ];
    },

    render: function (el) {
      var db = OD.db;
      var done = db.modules.filter(function (m) { return m.status === "done"; }).length;
      var hours = db.modules.reduce(function (s, m) { return s + (Number(m.hours) || 0); }, 0);
      var passed = db.certs.filter(function (c) { return c.status === "passed"; }).length;
      var pct = db.modules.length ? (done / db.modules.length) * 100 : 0;

      var html = '<div class="tiles">' +
        '<div class="tile"><div class="tile-label">Curriculum</div><div class="tile-value">' + done + " <small>of " + db.modules.length + " modules</small></div>" +
        '<div style="margin-top:8px">' + OD.charts.meter(pct) + "</div></div>" +
        '<div class="tile"><div class="tile-label">Hours logged</div><div class="tile-value">' + hours + "</div></div>" +
        '<div class="tile"><div class="tile-label">Certifications</div><div class="tile-value">' + passed + " <small>of " + db.certs.length + " passed</small></div></div>" +
        '<div class="tile"><div class="tile-label">Commands in the vault</div><div class="tile-value">' + db.commands.length + "</div></div>" +
        "</div>";

      /* curriculum */
      var modRows = db.modules.map(function (m) {
        return '<tr class="clickable" data-module="' + m.id + '">' +
          "<td><b>" + esc(m.name) + "</b></td>" +
          "<td>" + OD.ui.badge(m.status, MOD_TONE[m.status]) + "</td>" +
          '<td class="num">' + esc(m.hours || 0) + "</td>" +
          '<td class="fade">' + esc(m.topics) + "</td>" +
          '<td class="fade">' + esc(m.proof) + "</td></tr>";
      }).join("");

      html += '<div class="card section-gap"><div class="card-title">Curriculum <span class="right hint">click a row to edit</span></div>' +
        OD.ui.table(["Module", "Status", { label: "Hours", cls: "num" }, "Topics", "Proof of work"], modRows,
          "Add your first module — small, finishable, with a proof of work.") + "</div>";

      /* certs + vault side by side */
      var certRows = db.certs.map(function (c) {
        return '<tr class="clickable" data-cert="' + c.id + '"><td><b>' + esc(c.name) + "</b></td>" +
          "<td>" + OD.ui.badge(c.status, CERT_TONE[c.status]) + "</td>" +
          '<td class="fade">' + esc(c.date ? OD.fmt.dateFull(c.date) : "—") + "</td></tr>";
      }).join("");

      var cmds = db.commands.filter(function (c) {
        if (!search) return true;
        var q = search.toLowerCase();
        return (c.cmd + " " + c.what).toLowerCase().indexOf(q) !== -1;
      });
      var cmdRows = cmds.map(function (c) {
        return '<tr class="clickable" data-cmd="' + c.id + '"><td class="mono">' + esc(c.cmd) + "</td><td>" + esc(c.what) + "</td></tr>";
      }).join("");

      html += '<div class="grid grid-2 section-gap">' +
        '<div class="card"><div class="card-title">Certifications ' +
        '<button class="btn sm ghost right" id="add-cert" type="button">+ Add</button></div>' +
        OD.ui.table(["Certification", "Status", "Date"], certRows, "Track exam targets here.") + "</div>" +
        '<div class="card"><div class="card-title">Command vault ' +
        '<button class="btn sm ghost right" id="add-cmd" type="button">+ Add</button></div>' +
        '<div class="filters"><input class="control search-input" id="cmd-search" type="search" placeholder="Search the vault…" value="' + esc(search) + '"></div>' +
        OD.ui.table(["Command", "What it does"], cmdRows,
          db.commands.length ? "Nothing matches." : "Commands you want to know cold live here — then Drill them.") +
        "</div></div>";

      el.innerHTML = html;

      /* wiring */
      el.querySelectorAll("[data-module]").forEach(function (r) {
        r.addEventListener("click", function () {
          moduleForm(db.modules.find(function (m) { return m.id === r.getAttribute("data-module"); }));
        });
      });
      el.querySelectorAll("[data-cert]").forEach(function (r) {
        r.addEventListener("click", function () {
          certForm(db.certs.find(function (c) { return c.id === r.getAttribute("data-cert"); }));
        });
      });
      el.querySelectorAll("[data-cmd]").forEach(function (r) {
        r.addEventListener("click", function () {
          commandForm(db.commands.find(function (c) { return c.id === r.getAttribute("data-cmd"); }));
        });
      });
      el.querySelector("#add-cert").addEventListener("click", function () { certForm(null); });
      el.querySelector("#add-cmd").addEventListener("click", function () { commandForm(null); });
      var searchEl = el.querySelector("#cmd-search");
      searchEl.addEventListener("input", function () {
        search = searchEl.value;
        var pos = searchEl.selectionStart;
        OD.app.refresh();
        var again = document.getElementById("cmd-search");
        if (again) { again.focus(); again.setSelectionRange(pos, pos); }
      });
    }
  };
})();
