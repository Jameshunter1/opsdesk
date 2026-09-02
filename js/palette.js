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
    var simple = OD.isSimple();
    var name = function (v) { return OD.viewLabel(v); };

    // navigation — only modules that are switched on
    ["dashboard", "projects", "fitness", "fuel", "study", "lab", "desk", "ledger", "pipeline", "settings"].forEach(function (v) {
      if (v !== "dashboard" && v !== "settings" && !OD.moduleOn(v)) return;
      ix.push({ label: "Go to " + name(v), sub: "", module: "Nav", tone: "plain", go: "#/" + v });
    });

    // quick actions
    if (OD.moduleOn("fuel")) ix.push({ label: "Log today's food", sub: "protein, carbs, fat + supplements", module: name("fuel"), tone: "accent", go: "#/fuel", open: function () { OD.views.fuel.logToday(); } });
    if (OD.moduleOn("fitness")) ix.push({ label: "Log workout", sub: "lifting or cardio", module: name("fitness"), tone: "accent", go: "#/fitness", open: function () { OD.views.fitness.newWorkout(); } });
    if (OD.moduleOn("fitness")) ix.push({ label: "Weigh-in", sub: "add a body-weight check-in", module: name("fitness"), tone: "accent", go: "#/fitness", open: function () { OD.views.fitness.newWeighin(); } });
    if (OD.moduleOn("study")) ix.push({ label: "Log study time", sub: "minutes toward today's target", module: name("study"), tone: "accent", go: "#/study", open: function () { OD.views.study.logStudy(); } });
    if (OD.moduleOn("projects")) ix.push({ label: "New project", sub: "an outcome with steps", module: name("projects"), tone: "accent", go: "#/projects", open: function () { OD.views.projects.newProject(); } });
    ix.push({ label: "Manage habits", sub: "the check-off goals in your day score", module: "Nav", tone: "accent", go: "#/dashboard", open: function () { OD.views.dashboard.manageHabits(); } });
    if (OD.moduleOn("desk")) ix.push({ label: simple ? "New to-do" : "New ticket", sub: simple ? "add something to handle" : "open an incident or task", module: name("desk"), tone: "accent", go: "#/desk", open: function () { OD.views.desk.newTicket(); } });
    if (OD.moduleOn("ledger")) ix.push({ label: simple ? "Add money in or out" : "New transaction", sub: simple ? "spent, got paid, or moved money" : "post to the ledger", module: name("ledger"), tone: "accent", go: "#/ledger", open: function () { OD.views.ledger.newTxn(); } });
    if (OD.moduleOn("pipeline")) ix.push({ label: "New application", sub: "track a job posting", module: name("pipeline"), tone: "accent", go: "#/pipeline", open: function () { OD.views.pipeline.newJob(); } });
    if (OD.moduleOn("lab")) ix.push({ label: "New VM", sub: "add a machine to the fleet", module: name("lab"), tone: "accent", go: "#/lab", open: function () { OD.views.lab.newVm(); } });
    if (OD.moduleOn("study")) ix.push({ label: simple ? "New topic" : "New module", sub: simple ? "something you're learning" : "add to the curriculum", module: name("study"), tone: "accent", go: "#/study", open: function () { OD.views.study.newModule(); } });
    ix.push({ label: "Export backup", sub: "download everything as JSON", module: "Settings", tone: "plain", go: "", open: function () { OD.store.exportJson(); OD.ui.toast("Backup downloaded."); } });

    if (OD.moduleOn("lab")) {
      db.vms.forEach(function (v) {
        ix.push({ label: v.name, sub: [v.os, v.zone, v.ip].filter(Boolean).join(" · "), extra: v.role, module: name("lab"), tone: "good", go: "#/lab", open: function () { OD.views.lab.openVm(v.id); } });
      });
      db.zones.forEach(function (z) {
        ix.push({ label: z.name + " zone", sub: [z.iface, z.subnet].filter(Boolean).join(" · "), module: name("lab"), tone: "good", go: "#/lab", open: function () { OD.views.lab.openZone(z.id); } });
      });
    }
    if (OD.moduleOn("desk")) db.tickets.forEach(function (t) {
      ix.push({ label: t.num + " — " + t.title, sub: t.status + " · " + t.area, extra: [t.symptom, t.cause, t.lesson].join(" "), module: name("desk"), tone: "warning", go: "#/desk", open: function () { OD.views.desk.openTicket(t.id); } });
    });
    if (OD.moduleOn("projects")) db.projects.forEach(function (p) {
      var open = (p.tasks || []).filter(function (t) { return !t.done; }).length;
      ix.push({ label: p.name, sub: p.status + " · " + open + " steps left", extra: p.why, module: name("projects"), tone: "accent", go: "#/projects", open: function () { OD.views.projects.openProject(p.id); } });
    });
    if (OD.moduleOn("fitness")) db.workouts.slice(-60).forEach(function (w) {
      ix.push({ label: w.label, sub: OD.fmt.date(w.date) + " · " + (w.kind === "cardio" ? (w.minutes + " min") : (w.entries || []).length + " exercises"), module: name("fitness"), tone: "good", go: "#/fitness", open: function () { OD.views.fitness.openWorkout(w.id); } });
    });
    if (OD.moduleOn("ledger")) {
      db.accounts.forEach(function (a) {
        ix.push({ label: a.name, sub: a.type + " account", module: name("ledger"), tone: "accent", go: "#/ledger", open: function () { OD.views.ledger.openAccount(a.id); } });
      });
      db.txns.forEach(function (t) {
        ix.push({ label: t.desc, sub: OD.fmt.date(t.date) + " · " + OD.fmt.money(t.amount), module: name("ledger"), tone: "accent", go: "#/ledger", open: function () { OD.views.ledger.openTxn(t.id); } });
      });
    }
    if (OD.moduleOn("pipeline")) db.jobs.forEach(function (j) {
      ix.push({ label: j.company + " — " + j.role, sub: j.status + (j.source ? " · " + j.source : ""), extra: j.notes, module: name("pipeline"), tone: "plain", go: "#/pipeline", open: function () { OD.views.pipeline.openJob(j.id); } });
    });
    if (OD.moduleOn("study")) {
      db.modules.forEach(function (m) {
        ix.push({ label: m.name, sub: m.status, extra: m.topics, module: name("study"), tone: "critical", go: "#/study", open: function () { OD.views.study.openModule(m.id); } });
      });
      db.certs.forEach(function (c) {
        ix.push({ label: c.name, sub: c.status, module: name("study"), tone: "critical", go: "#/study", open: function () { OD.views.study.openCert(c.id); } });
      });
      if (!simple) db.commands.forEach(function (c) {
        ix.push({ label: c.cmd, sub: c.what, module: name("study"), tone: "critical", go: "#/study", open: function () { OD.views.study.openCommand(c.id); } });
      });
    }

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
