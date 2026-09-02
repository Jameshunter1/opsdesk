/* OpsDesk — command palette (Ctrl+K or /).
   One search box over everything: VMs, zones, tickets, KB lessons, accounts,
   transactions, applications, modules, certs, commands — plus navigation
   and quick "new …" actions. Enter jumps straight to the record. */
(function () {
  "use strict";

  var esc = function (s) { return OD.ui.esc(s); };
  var isOpen = false;

  /* ---------- index ---------- */

  function buildIndex() {
    var ix = [];
    var db = OD.db;

    // navigation
    [["dashboard", "Dashboard"], ["lab", "Lab"], ["desk", "Desk"], ["ledger", "Ledger"],
     ["pipeline", "Pipeline"], ["study", "Study"], ["settings", "Settings"]].forEach(function (v) {
      ix.push({ label: "Go to " + v[1], sub: "", module: "Nav", tone: "plain", go: "#/" + v[0] });
    });

    // quick actions
    ix.push({ label: "New ticket", sub: "open an incident or task", module: "Desk", tone: "accent", go: "#/desk", open: function () { OD.views.desk.newTicket(); } });
    ix.push({ label: "New transaction", sub: "post to the ledger", module: "Ledger", tone: "accent", go: "#/ledger", open: function () { OD.views.ledger.newTxn(); } });
    ix.push({ label: "New application", sub: "track a job posting", module: "Pipeline", tone: "accent", go: "#/pipeline", open: function () { OD.views.pipeline.newJob(); } });
    ix.push({ label: "New VM", sub: "add a machine to the fleet", module: "Lab", tone: "accent", go: "#/lab", open: function () { OD.views.lab.newVm(); } });
    ix.push({ label: "New module", sub: "add to the curriculum", module: "Study", tone: "accent", go: "#/study", open: function () { OD.views.study.newModule(); } });
    ix.push({ label: "Export backup", sub: "download everything as JSON", module: "Settings", tone: "plain", go: "", open: function () { OD.store.exportJson(); OD.ui.toast("Backup downloaded."); } });

    db.vms.forEach(function (v) {
      ix.push({ label: v.name, sub: [v.os, v.zone, v.ip].filter(Boolean).join(" · "), extra: v.role, module: "Lab", tone: "good", go: "#/lab", open: function () { OD.views.lab.openVm(v.id); } });
    });
    db.zones.forEach(function (z) {
      ix.push({ label: z.name + " zone", sub: [z.iface, z.subnet].filter(Boolean).join(" · "), module: "Lab", tone: "good", go: "#/lab", open: function () { OD.views.lab.openZone(z.id); } });
    });
    db.tickets.forEach(function (t) {
      ix.push({ label: t.num + " — " + t.title, sub: t.status + " · " + t.area, extra: [t.symptom, t.cause, t.lesson].join(" "), module: "Desk", tone: "warning", go: "#/desk", open: function () { OD.views.desk.openTicket(t.id); } });
    });
    db.accounts.forEach(function (a) {
      ix.push({ label: a.name, sub: a.type + " account", module: "Ledger", tone: "accent", go: "#/ledger", open: function () { OD.views.ledger.openAccount(a.id); } });
    });
    db.txns.forEach(function (t) {
      ix.push({ label: t.desc, sub: OD.fmt.date(t.date) + " · " + OD.fmt.money(t.amount), module: "Ledger", tone: "accent", go: "#/ledger", open: function () { OD.views.ledger.openTxn(t.id); } });
    });
    db.jobs.forEach(function (j) {
      ix.push({ label: j.company + " — " + j.role, sub: j.status + (j.source ? " · " + j.source : ""), extra: j.notes, module: "Pipeline", tone: "plain", go: "#/pipeline", open: function () { OD.views.pipeline.openJob(j.id); } });
    });
    db.modules.forEach(function (m) {
      ix.push({ label: m.name, sub: m.status, extra: m.topics, module: "Study", tone: "critical", go: "#/study", open: function () { OD.views.study.openModule(m.id); } });
    });
    db.certs.forEach(function (c) {
      ix.push({ label: c.name, sub: c.status + " · certification", module: "Study", tone: "critical", go: "#/study", open: function () { OD.views.study.openCert(c.id); } });
    });
    db.commands.forEach(function (c) {
      ix.push({ label: c.cmd, sub: c.what, module: "Study", tone: "critical", go: "#/study", open: function () { OD.views.study.openCommand(c.id); } });
    });

    return ix;
  }

  function score(entry, q) {
    var label = entry.label.toLowerCase();
    var sub = (entry.sub || "").toLowerCase();
    var extra = (entry.extra || "").toLowerCase();
    if (label.indexOf(q) === 0) return 3;
    if (label.indexOf(q) !== -1) return 2;
    if (sub.indexOf(q) !== -1 || extra.indexOf(q) !== -1) return 1;
    return 0;
  }

  /* ---------- UI ---------- */

  function openPalette() {
    if (isOpen) return;
    isOpen = true;
    var ix = buildIndex();
    var active = 0;
    var results = [];

    var m = OD.ui.openModal(
      '<div class="palette">' +
      '<input class="control palette-input" id="palette-q" type="search" ' +
      'placeholder="Search everything — tickets, VMs, money, jobs, commands…" autocomplete="off">' +
      '<div class="palette-list" id="palette-list"></div>' +
      '<div class="palette-foot"><span><span class="kbd">↑↓</span> move</span>' +
      '<span><span class="kbd">Enter</span> open</span><span><span class="kbd">Esc</span> close</span></div>' +
      "</div>", true
    );
    m.classList.add("palette-modal");
    var input = m.querySelector("#palette-q");
    var list = m.querySelector("#palette-list");

    function run() {
      var q = input.value.trim().toLowerCase();
      if (!q) {
        results = ix.filter(function (e) { return e.module === "Nav" || e.tone === "accent"; }).slice(0, 10);
      } else {
        results = ix
          .map(function (e) { return { e: e, s: score(e, q) }; })
          .filter(function (r) { return r.s > 0; })
          .sort(function (a, b) { return b.s - a.s || a.e.label.localeCompare(b.e.label); })
          .slice(0, 12)
          .map(function (r) { return r.e; });
      }
      active = 0;
      draw();
    }

    function draw() {
      if (!results.length) {
        list.innerHTML = '<div class="empty">No matches. Try a ticket number, a VM name, a company…</div>';
        return;
      }
      list.innerHTML = results.map(function (r, i) {
        return '<div class="palette-item' + (i === active ? " active" : "") + '" data-i="' + i + '">' +
          '<span class="palette-module">' + OD.ui.badge(r.module, r.tone) + "</span>" +
          '<span class="palette-text"><b>' + esc(r.label) + "</b>" +
          (r.sub ? '<span class="palette-sub">' + esc(r.sub) + "</span>" : "") + "</span></div>";
      }).join("");
      list.querySelectorAll(".palette-item").forEach(function (el) {
        el.addEventListener("mouseenter", function () {
          active = Number(el.getAttribute("data-i"));
          draw();
        });
        el.addEventListener("click", function () { choose(results[Number(el.getAttribute("data-i"))]); });
      });
      var act = list.querySelector(".palette-item.active");
      if (act) act.scrollIntoView({ block: "nearest" });
    }

    function choose(entry) {
      OD.ui.closeModal();
      if (entry.go && location.hash !== entry.go) {
        location.hash = entry.go;
        // hashchange renders the view; open the record right after
        if (entry.open) setTimeout(entry.open, 40);
      } else if (entry.open) {
        entry.open();
      }
    }

    input.addEventListener("input", run);
    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") { e.preventDefault(); active = Math.min(active + 1, results.length - 1); draw(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); active = Math.max(active - 1, 0); draw(); }
      else if (e.key === "Enter") { e.preventDefault(); if (results[active]) choose(results[active]); }
    });

    // the modal root empties when any code closes the modal — track that
    var watch = setInterval(function () {
      if (!document.getElementById("palette-q")) { isOpen = false; clearInterval(watch); }
    }, 200);

    run();
    input.focus();
  }

  OD.palette = { open: openPalette };

  /* ---------- global bindings ---------- */

  document.addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      openPalette();
      return;
    }
    if (e.key === "/" && !isOpen) {
      var t = e.target;
      var typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
      var modalUp = document.querySelector(".modal-overlay");
      if (!typing && !modalUp) {
        e.preventDefault();
        openPalette();
      }
    }
  });

  document.addEventListener("DOMContentLoaded", function () {
    var btn = document.getElementById("search-btn");
    if (btn) btn.addEventListener("click", openPalette);
  });
})();
