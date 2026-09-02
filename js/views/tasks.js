/* OpsDesk — Tasks: one answer to "what should I do next?"
   Projects (multi-step outcomes, each showing exactly one next action)
   sit on top; loose to-dos below; everything you've solved and written a
   lesson for lives in the Solved & saved tab. */
(function () {
  "use strict";

  var esc = function (s) { return OD.ui.esc(s); };

  var tab = "do";
  var filterStatus = "all";
  var search = "";

  var PRIORITY_TONE = { high: "critical", medium: "warning", low: "plain" };
  var STATUS_TONE = { open: "warning", "in-progress": "accent", resolved: "good" };
  var PROJECT_TONE = { active: "accent", paused: "plain", done: "good" };

  function typeLabel(t) {
    if (!OD.isSimple()) return t.type;
    return t.type === "task" ? "to-do" : "problem";
  }

  /* ---------- to-dos (tickets) ---------- */

  function ticketForm(t) {
    var simple = OD.isSimple();
    var typeOpts = simple
      ? [{ value: "task", label: "To-do" }, { value: "incident", label: "Problem to solve" }]
      : OD.enums.ticketType;
    var areaOpts = simple
      ? ["home", "money", "work", "family", "health", "other"]
      : OD.enums.ticketArea;
    OD.ui.form({
      title: t ? "Edit " + t.num : (simple ? "New to-do" : "New ticket"),
      values: t,
      fields: [
        { key: "title", label: simple ? "What needs doing?" : "Title", required: true, span2: true, placeholder: simple ? "Short and clear — you'll search for this later" : "Short, searchable summary of the problem or task" },
        { key: "type", label: "Type", type: "select", options: typeOpts, default: "task" },
        { key: "area", label: "Area", type: "select", options: areaOpts },
        { key: "priority", label: "Priority", type: "select", options: OD.enums.ticketPriority, default: "medium" },
        { key: "status", label: "Status", type: "select", options: OD.enums.ticketStatus },
        { key: "symptom", label: simple ? "What's going on?" : "Symptom", type: "textarea", span2: true, placeholder: simple ? "Describe it in your own words (optional)" : "What it looked like from the outside" },
        { key: "cause", label: simple ? "What caused it?" : "Root cause", type: "textarea", span2: true, placeholder: simple ? "If you figured it out (optional)" : "The actual reason — not the first scary error line" },
        { key: "fix", label: simple ? "The plan / what fixed it" : "Fix / plan", type: "textarea", span2: true, placeholder: simple ? "Steps to take, or what worked" : "What resolved it, or the steps to take" },
        { key: "lesson", label: simple ? "Worth remembering" : "Lesson", type: "textarea", span2: true, placeholder: simple ? "One line so future-you doesn't relearn it" : "The one-liner future-you needs. This is what goes in Solved & saved." }
      ],
      onSubmit: function (v) {
        if (t) {
          var wasResolved = t.status === "resolved";
          Object.assign(t, v);
          if (v.status === "resolved" && !wasResolved && !t.resolved) t.resolved = OD.todayISO();
          if (v.status !== "resolved") t.resolved = "";
        } else {
          v.id = OD.uid();
          v.num = OD.query.nextTicketNumber();
          v.opened = OD.todayISO();
          v.resolved = v.status === "resolved" ? OD.todayISO() : "";
          OD.db.tickets.push(v);
        }
        OD.store.save();
        OD.app.refresh();
        OD.ui.toast(t ? "Updated." : "Added.");
      },
      onDelete: t && function () {
        OD.ui.confirm({ title: "Delete this?", message: t.num + " — " + t.title }, function () {
          OD.db.tickets = OD.db.tickets.filter(function (x) { return x.id !== t.id; });
          OD.store.save();
          OD.app.refresh();
          OD.ui.toast("Deleted.");
        });
      }
    });
  }

  function block(label, text) {
    if (!text) return "";
    return '<div class="kb-part"><b>' + esc(label) + '</b><div class="prose-block">' + esc(text) + "</div></div>";
  }

  function ticketDetail(t) {
    var actions = "";
    if (t.status === "open") actions += '<button class="btn" data-act="start" type="button">Start work</button>';
    if (t.status !== "resolved") actions += '<button class="btn primary" data-act="resolve" type="button">Done</button>';
    else actions += '<button class="btn" data-act="reopen" type="button">Reopen</button>';

    var m = OD.ui.openModal(
      OD.ui.modalHead(t.num + " — " + t.title) +
      '<div class="row" style="margin-bottom:12px">' +
      OD.ui.badge(typeLabel(t), "plain") + OD.ui.badge(t.area, "plain") +
      OD.ui.badge(t.priority, PRIORITY_TONE[t.priority]) + OD.ui.badge(t.status, STATUS_TONE[t.status]) +
      '<span class="hint right">opened ' + esc(OD.fmt.dateFull(t.opened)) +
      (t.resolved ? " · resolved " + esc(OD.fmt.dateFull(t.resolved)) : "") + "</span></div>" +
      block("Symptom", t.symptom) + block("Root cause", t.cause) + block("Fix", t.fix) + block("Lesson", t.lesson) +
      '<div class="modal-actions"><button class="btn ghost" data-act="edit" type="button">Edit</button>' + actions + "</div>"
    );

    m.querySelector('[data-act="edit"]').addEventListener("click", function () {
      OD.ui.closeModal();
      ticketForm(t);
    });
    var start = m.querySelector('[data-act="start"]');
    if (start) start.addEventListener("click", function () {
      t.status = "in-progress";
      OD.store.save(); OD.ui.closeModal(); OD.app.refresh();
    });
    var resolve = m.querySelector('[data-act="resolve"]');
    if (resolve) resolve.addEventListener("click", function () {
      t.status = "resolved";
      t.resolved = OD.todayISO();
      OD.store.save(); OD.ui.closeModal(); OD.app.refresh();
      OD.ui.toast(t.lesson ? t.num + " done and filed in Solved & saved." : t.num + " done — add a lesson to file it.");
    });
    var reopen = m.querySelector('[data-act="reopen"]');
    if (reopen) reopen.addEventListener("click", function () {
      t.status = "open";
      t.resolved = "";
      OD.store.save(); OD.ui.closeModal(); OD.app.refresh();
    });
  }

  function matches(t, q) {
    if (!q) return true;
    q = q.toLowerCase();
    return [t.num, t.title, t.symptom, t.cause, t.fix, t.lesson, t.area].join(" ").toLowerCase().indexOf(q) !== -1;
  }

  /* ---------- projects ---------- */

  function projectForm(p) {
    OD.ui.form({
      title: p ? "Edit project" : "New project",
      values: p,
      fields: [
        { key: "name", label: "Project", required: true, span2: true, placeholder: "Pass Network+, clear the garage, rebuild resume…" },
        { key: "why", label: "Why it matters", span2: true, placeholder: "One line — this shows up when motivation doesn't" },
        { key: "status", label: "Status", type: "select", options: ["active", "paused", "done"] },
        { key: "due", label: "Target date", type: "date" }
      ],
      onSubmit: function (v) {
        if (p) Object.assign(p, v);
        else { v.id = OD.uid(); v.tasks = []; OD.db.projects.push(v); }
        OD.store.save();
        OD.app.refresh();
        OD.ui.toast(p ? "Project updated." : "Project added — now give it a first step.");
      },
      onDelete: p && function () {
        OD.ui.confirm({ title: "Delete project?", message: p.name + " and its steps." }, function () {
          OD.db.projects = OD.db.projects.filter(function (x) { return x.id !== p.id; });
          OD.store.save();
          OD.app.refresh();
        });
      }
    });
  }

  function addStep(p, text) {
    text = (text || "").trim();
    if (!text) return;
    p.tasks.push({ id: OD.uid(), text: text, done: false, doneDate: "" });
    OD.store.save();
    OD.app.refresh();
  }

  function nextStep(p) {
    return (p.tasks || []).find(function (t) { return !t.done; }) || null;
  }

  function projectCard(p) {
    var next = nextStep(p);
    var total = (p.tasks || []).length;
    var done = p.tasks.filter(function (t) { return t.done; }).length;

    var stepRows = (p.tasks || []).map(function (t) {
      return '<label class="task-row' + (t.done ? " done" : "") + '">' +
        '<input type="checkbox" data-step="' + t.id + '" data-project="' + p.id + '"' + (t.done ? " checked" : "") + ">" +
        "<span>" + esc(t.text) + "</span>" +
        '<button class="task-del" data-del-step="' + t.id + '" data-project="' + p.id + '" type="button" title="Remove">×</button>' +
        "</label>";
    }).join("");

    return '<div class="card project-card">' +
      '<div class="spread">' +
      '<div><span class="kb-title">' + esc(p.name) + "</span>" +
      (p.why ? '<div class="hint">' + esc(p.why) + "</div>" : "") + "</div>" +
      '<div class="row">' + OD.ui.badge(p.status, PROJECT_TONE[p.status]) +
      (p.due ? '<span class="hint">due ' + esc(OD.fmt.dateFull(p.due)) + "</span>" : "") +
      '<button class="btn sm ghost" data-edit-project="' + p.id + '" type="button">Edit</button></div>' +
      "</div>" +
      '<div class="row" style="margin:10px 0 6px;gap:12px"><div style="flex:1">' + OD.charts.meter(total ? (done / total) * 100 : 0) + "</div>" +
      '<span class="hint">' + done + "/" + total + "</span></div>" +
      (p.status === "active"
        ? (next
          ? '<div class="next-action"><span class="next-tag">Next</span> ' + esc(next.text) + "</div>"
          : '<div class="next-action empty-next">' + (total ? "All steps done — mark it done, or add what's next." : "Give this project its first step below.") + "</div>")
        : "") +
      (stepRows ? '<div class="task-list">' + stepRows + "</div>" : "") +
      '<div class="row" style="margin-top:10px">' +
      '<input class="control" data-new-step="' + p.id + '" placeholder="Add a step…" style="flex:1">' +
      '<button class="btn sm" data-add-step="' + p.id + '" type="button">Add</button></div>' +
      "</div>";
  }

  /* ---------- view ---------- */

  OD.views.tasks = {
    title: "Tasks",
    actions: function () {
      return [
        { label: OD.isSimple() ? "+ To-do" : "+ Ticket", onClick: function () { ticketForm(null); } },
        { label: "+ Project", primary: true, onClick: function () { projectForm(null); } }
      ];
    },

    render: function (el) {
      var db = OD.db;
      var simple = OD.isSimple();
      var kbCount = db.tickets.filter(function (t) { return t.status === "resolved" && t.lesson; }).length;

      var html = '<div class="filters">' +
        '<button class="btn sm' + (tab === "do" ? " primary" : "") + '" data-tab="do" type="button">Do</button>' +
        '<button class="btn sm' + (tab === "kb" ? " primary" : "") + '" data-tab="kb" type="button">Solved & saved (' + kbCount + ")</button>" +
        '<span class="right"></span>';

      if (tab === "do") {
        html += '<select class="control" id="tasks-status"><option value="all"' + (filterStatus === "all" ? " selected" : "") + ">All statuses</option>" +
          OD.enums.ticketStatus.map(function (s) {
            return '<option value="' + s + '"' + (filterStatus === s ? " selected" : "") + ">" + OD.fmt.title(s) + "</option>";
          }).join("") + "</select>";
      }
      html += '<input class="control search-input" id="tasks-search" type="search" placeholder="Search everything here…" value="' + esc(search) + '"></div>';

      if (tab === "do") {
        /* projects first */
        var q = search.toLowerCase();
        var projs = db.projects.filter(function (p) {
          if (!q) return true;
          return (p.name + " " + (p.why || "") + " " + (p.tasks || []).map(function (t) { return t.text; }).join(" ")).toLowerCase().indexOf(q) !== -1;
        });
        var active = projs.filter(function (p) { return p.status === "active"; });
        var rest = projs.filter(function (p) { return p.status !== "active"; });

        if (db.projects.length) {
          html += active.map(projectCard).join("");
          if (rest.length) {
            html += '<details class="section-gap"><summary class="hint" style="cursor:pointer">Paused & done projects (' + rest.length + ")</summary>" +
              '<div style="margin-top:10px">' + rest.map(projectCard).join("") + "</div></details>";
          }
        } else {
          html += '<div class="card"><div class="empty">A project is anything with more than one step — add one and it always shows you just the <b>next</b> step.</div></div>';
        }

        /* loose to-dos below */
        var list = db.tickets
          .filter(function (t) { return filterStatus === "all" || t.status === filterStatus; })
          .filter(function (t) { return matches(t, search); })
          .slice()
          .sort(function (a, b) { return a.opened < b.opened ? 1 : -1; });

        var rows = list.map(function (t) {
          return '<tr class="clickable" data-ticket="' + t.id + '">' +
            '<td class="mono fade">' + esc(t.num) + "</td>" +
            "<td><b>" + esc(t.title) + "</b></td>" +
            "<td>" + OD.ui.badge(typeLabel(t), "plain") + "</td>" +
            "<td>" + OD.ui.badge(t.priority, PRIORITY_TONE[t.priority]) + "</td>" +
            "<td>" + OD.ui.badge(t.status, STATUS_TONE[t.status]) + "</td>" +
            '<td class="fade">' + esc(OD.fmt.date(t.opened)) + "</td></tr>";
        }).join("");

        html += '<div class="card section-gap"><div class="card-title">' + (simple ? "Loose to-dos" : "Tickets") + "</div>" +
          OD.ui.table(["#", "Title", "Type", "Priority", "Status", "Opened"], rows,
            db.tickets.length ? "Nothing matches that filter." : "One-off things live here; multi-step things become projects above.") +
          "</div>";
      } else {
        var articles = db.tickets
          .filter(function (t) { return t.status === "resolved" && t.lesson && matches(t, search); })
          .slice()
          .sort(function (a, b) { return (a.resolved || "") < (b.resolved || "") ? 1 : -1; });

        var cards = articles.map(function (t) {
          return '<div class="kb-card clickable" data-ticket="' + t.id + '" style="cursor:pointer">' +
            '<div class="spread"><span class="kb-title">' + esc(t.title) + '</span><span class="hint mono">' + esc(t.num) + "</span></div>" +
            block("Root cause", t.cause) + block("Fix", t.fix) + block("Lesson", t.lesson) +
            "</div>";
        }).join("");

        html += '<div class="card">' +
          (cards || '<div class="empty">Finish something with a lesson written down and it lands here — your own searchable answer book.</div>') +
          "</div>";
      }

      el.innerHTML = html;

      /* wiring */
      el.querySelectorAll("[data-tab]").forEach(function (b) {
        b.addEventListener("click", function () { tab = b.getAttribute("data-tab"); OD.app.refresh(); });
      });
      var statusSel = el.querySelector("#tasks-status");
      if (statusSel) statusSel.addEventListener("change", function () { filterStatus = statusSel.value; OD.app.refresh(); });
      var searchEl = el.querySelector("#tasks-search");
      searchEl.addEventListener("input", function () {
        search = searchEl.value;
        var pos = searchEl.selectionStart;
        OD.app.refresh();
        var again = document.getElementById("tasks-search");
        if (again) { again.focus(); again.setSelectionRange(pos, pos); }
      });
      el.querySelectorAll("[data-ticket]").forEach(function (r) {
        r.addEventListener("click", function () {
          ticketDetail(db.tickets.find(function (t) { return t.id === r.getAttribute("data-ticket"); }));
        });
      });
      el.querySelectorAll("[data-edit-project]").forEach(function (b) {
        b.addEventListener("click", function () {
          projectForm(db.projects.find(function (p) { return p.id === b.getAttribute("data-edit-project"); }));
        });
      });
      el.querySelectorAll("[data-step]").forEach(function (cb) {
        cb.addEventListener("change", function () {
          var p = db.projects.find(function (x) { return x.id === cb.getAttribute("data-project"); });
          var t = p.tasks.find(function (x) { return x.id === cb.getAttribute("data-step"); });
          t.done = cb.checked;
          t.doneDate = cb.checked ? OD.todayISO() : "";
          OD.store.save();
          OD.app.refresh();
          if (cb.checked && !nextStep(p)) OD.ui.toast('"' + p.name + '" — every step done. Nice.');
        });
      });
      el.querySelectorAll("[data-del-step]").forEach(function (b) {
        b.addEventListener("click", function (e) {
          e.preventDefault();
          var p = db.projects.find(function (x) { return x.id === b.getAttribute("data-project"); });
          p.tasks = p.tasks.filter(function (x) { return x.id !== b.getAttribute("data-del-step"); });
          OD.store.save();
          OD.app.refresh();
        });
      });
      el.querySelectorAll("[data-add-step]").forEach(function (b) {
        b.addEventListener("click", function () {
          var input = el.querySelector('[data-new-step="' + b.getAttribute("data-add-step") + '"]');
          addStep(db.projects.find(function (p) { return p.id === b.getAttribute("data-add-step"); }), input.value);
        });
      });
      el.querySelectorAll("[data-new-step]").forEach(function (input) {
        input.addEventListener("keydown", function (e) {
          if (e.key === "Enter") {
            e.preventDefault();
            addStep(db.projects.find(function (p) { return p.id === input.getAttribute("data-new-step"); }), input.value);
          }
        });
      });
    }
  };

  /* shared: the dashboard asks for next actions */
  OD.views.tasks.nextActions = function () {
    return OD.db.projects
      .filter(function (p) { return p.status === "active"; })
      .map(function (p) {
        var next = (p.tasks || []).find(function (t) { return !t.done; });
        return next ? { project: p.name, text: next.text, id: p.id } : null;
      })
      .filter(Boolean);
  };

  /* command-palette hooks */
  OD.views.tasks.newTicket = function () { ticketForm(null); };
  OD.views.tasks.openTicket = function (id) {
    var t = OD.db.tickets.find(function (x) { return x.id === id; });
    if (t) ticketDetail(t);
  };
  OD.views.tasks.newProject = function () { projectForm(null); };
  OD.views.tasks.openProject = function (id) {
    var p = OD.db.projects.find(function (x) { return x.id === id; });
    if (p) projectForm(p);
  };
})();
