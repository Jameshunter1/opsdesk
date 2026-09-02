/* OpsDesk — Projects: outcomes with steps.
   Each project shows one highlighted NEXT action — the anti-micromanagement
   trick: you never face the whole mountain, just the next step. */
(function () {
  "use strict";

  var esc = function (s) { return OD.ui.esc(s); };

  var STATUS_TONE = { active: "accent", paused: "plain", done: "good" };

  function projectForm(p) {
    OD.ui.form({
      title: p ? "Edit project" : "New project",
      values: p,
      fields: [
        { key: "name", label: "Project", required: true, span2: true, placeholder: "Pass Network+, rebuild resume, paint the fence…" },
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

  function addTask(p, text) {
    text = (text || "").trim();
    if (!text) return;
    p.tasks.push({ id: OD.uid(), text: text, done: false, doneDate: "" });
    OD.store.save();
    OD.app.refresh();
  }

  function nextTask(p) {
    return (p.tasks || []).find(function (t) { return !t.done; }) || null;
  }

  function progressOf(p) {
    var total = (p.tasks || []).length;
    if (!total) return 0;
    var done = p.tasks.filter(function (t) { return t.done; }).length;
    return (done / total) * 100;
  }

  function projectCard(p) {
    var next = nextTask(p);
    var total = (p.tasks || []).length;
    var done = p.tasks.filter(function (t) { return t.done; }).length;

    var taskRows = (p.tasks || []).map(function (t) {
      return '<label class="task-row' + (t.done ? " done" : "") + '">' +
        '<input type="checkbox" data-task="' + t.id + '" data-project="' + p.id + '"' + (t.done ? " checked" : "") + ">" +
        "<span>" + esc(t.text) + "</span>" +
        '<button class="task-del" data-del-task="' + t.id + '" data-project="' + p.id + '" type="button" title="Remove">×</button>' +
        "</label>";
    }).join("");

    return '<div class="card project-card">' +
      '<div class="spread">' +
      '<div><span class="kb-title">' + esc(p.name) + "</span>" +
      (p.why ? '<div class="hint">' + esc(p.why) + "</div>" : "") + "</div>" +
      '<div class="row">' + OD.ui.badge(p.status, STATUS_TONE[p.status]) +
      (p.due ? '<span class="hint">due ' + esc(OD.fmt.dateFull(p.due)) + "</span>" : "") +
      '<button class="btn sm ghost" data-edit-project="' + p.id + '" type="button">Edit</button></div>' +
      "</div>" +
      '<div class="row" style="margin:10px 0 6px;gap:12px"><div style="flex:1">' + OD.charts.meter(progressOf(p)) + "</div>" +
      '<span class="hint">' + done + "/" + total + "</span></div>" +
      (p.status === "active"
        ? (next
          ? '<div class="next-action"><span class="next-tag">Next</span> ' + esc(next.text) + "</div>"
          : '<div class="next-action empty-next">' + (total ? "All steps done — mark it done, or add what's next." : "Give this project its first step below.") + "</div>")
        : "") +
      (taskRows ? '<div class="task-list">' + taskRows + "</div>" : "") +
      '<div class="row" style="margin-top:10px">' +
      '<input class="control" data-new-task="' + p.id + '" placeholder="Add a step…" style="flex:1">' +
      '<button class="btn sm" data-add-task="' + p.id + '" type="button">Add</button></div>' +
      "</div>";
  }

  OD.views.projects = {
    title: "Projects",
    actions: function () {
      return [{ label: "+ Project", primary: true, onClick: function () { projectForm(null); } }];
    },

    render: function (el) {
      var db = OD.db;
      var active = db.projects.filter(function (p) { return p.status === "active"; });
      var rest = db.projects.filter(function (p) { return p.status !== "active"; });

      var html = "";
      if (!db.projects.length) {
        html = '<div class="card" style="text-align:center;padding:34px 20px">' +
          '<h3 style="font-size:17px;margin-bottom:6px">One outcome, many small steps</h3>' +
          '<p class="subtle" style="max-width:52ch;margin:0 auto 16px">A project is anything with more than one step. Add it, break it into steps, and OpsDesk always shows just the <b>next</b> one — on the dashboard too. Ticking a step counts toward your day.</p>' +
          '<button class="btn primary" id="proj-first" type="button">+ First project</button></div>';
      } else {
        html += active.map(projectCard).join("");
        if (rest.length) {
          html += '<div class="card-title section-gap" style="margin-bottom:10px">Paused & done</div>' + rest.map(projectCard).join("");
        }
      }

      el.innerHTML = html;

      var first = el.querySelector("#proj-first");
      if (first) first.addEventListener("click", function () { projectForm(null); });

      el.querySelectorAll("[data-edit-project]").forEach(function (b) {
        b.addEventListener("click", function () {
          projectForm(db.projects.find(function (p) { return p.id === b.getAttribute("data-edit-project"); }));
        });
      });
      el.querySelectorAll("[data-task]").forEach(function (cb) {
        cb.addEventListener("change", function () {
          var p = db.projects.find(function (x) { return x.id === cb.getAttribute("data-project"); });
          var t = p.tasks.find(function (x) { return x.id === cb.getAttribute("data-task"); });
          t.done = cb.checked;
          t.doneDate = cb.checked ? OD.todayISO() : "";
          OD.store.save();
          OD.app.refresh();
          if (cb.checked && !nextTask(p)) OD.ui.toast('"' + p.name + '" — every step done. Nice.');
        });
      });
      el.querySelectorAll("[data-del-task]").forEach(function (b) {
        b.addEventListener("click", function (e) {
          e.preventDefault();
          var p = db.projects.find(function (x) { return x.id === b.getAttribute("data-project"); });
          p.tasks = p.tasks.filter(function (x) { return x.id !== b.getAttribute("data-del-task"); });
          OD.store.save();
          OD.app.refresh();
        });
      });
      el.querySelectorAll("[data-add-task]").forEach(function (b) {
        b.addEventListener("click", function () {
          var input = el.querySelector('[data-new-task="' + b.getAttribute("data-add-task") + '"]');
          addTask(db.projects.find(function (p) { return p.id === b.getAttribute("data-add-task"); }), input.value);
        });
      });
      el.querySelectorAll("[data-new-task]").forEach(function (input) {
        input.addEventListener("keydown", function (e) {
          if (e.key === "Enter") {
            e.preventDefault();
            addTask(db.projects.find(function (p) { return p.id === input.getAttribute("data-new-task"); }), input.value);
          }
        });
      });
    }
  };

  /* shared: the dashboard asks for next actions */
  OD.views.projects.nextActions = function () {
    return OD.db.projects
      .filter(function (p) { return p.status === "active"; })
      .map(function (p) {
        var next = (p.tasks || []).find(function (t) { return !t.done; });
        return next ? { project: p.name, text: next.text, id: p.id } : null;
      })
      .filter(Boolean);
  };

  /* command-palette hooks */
  OD.views.projects.newProject = function () { projectForm(null); };
  OD.views.projects.openProject = function (id) {
    var p = OD.db.projects.find(function (x) { return x.id === id; });
    if (p) projectForm(p);
  };
})();
