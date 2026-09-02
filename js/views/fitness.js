/* OpsDesk — Training: a weekly routine that guides (never nags), a proper
   sets × reps × weight log, cardio sessions, weigh-ins, and PRs.
   Rest days count as kept — recovery is part of the plan. */
(function () {
  "use strict";

  var esc = function (s) { return OD.ui.esc(s); };

  var DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var SPLITS = {
    "Push / Pull / Legs": { 1: "Push", 2: "Pull", 3: "Legs", 4: "Push", 5: "Pull", 6: "Legs", 0: "" },
    "Upper / Lower ×4": { 1: "Upper", 2: "Lower", 4: "Upper", 5: "Lower", 0: "", 3: "", 6: "" },
    "Full body ×3": { 1: "Full body", 3: "Full body", 5: "Full body", 0: "", 2: "", 4: "", 6: "" }
  };

  /* ---------- routine ---------- */

  function routineForm() {
    var days = OD.db.routine.days || {};
    var presetBtns = Object.keys(SPLITS).map(function (k) {
      return '<button class="btn sm" data-preset="' + esc(k) + '" type="button">' + esc(k) + "</button>";
    }).join("") + '<button class="btn sm ghost" data-preset="__clear" type="button">Clear all</button>';

    var rows = DAY_NAMES.map(function (name, i) {
      return '<div class="field"><label for="rt-' + i + '">' + name + "</label>" +
        '<input class="control" id="rt-' + i + '" data-day="' + i + '" value="' + esc(days[i] || "") + '" placeholder="Rest"></div>';
    }).join("");

    var m = OD.ui.openModal(
      OD.ui.modalHead("My weekly routine") +
      '<p class="subtle">Name each training day (blank = rest). The app will show what today is and count showing up — rest days count as kept.</p>' +
      '<div class="row" style="margin:12px 0">' + presetBtns + "</div>" +
      '<div class="form-grid">' + rows + "</div>" +
      '<div class="modal-actions"><button class="btn" data-act="cancel" type="button">Cancel</button>' +
      '<button class="btn primary" data-act="save" type="button">Save routine</button></div>'
    );

    m.querySelectorAll("[data-preset]").forEach(function (b) {
      b.addEventListener("click", function () {
        var k = b.getAttribute("data-preset");
        var p = k === "__clear" ? { 0: "", 1: "", 2: "", 3: "", 4: "", 5: "", 6: "" } : SPLITS[k];
        m.querySelectorAll("[data-day]").forEach(function (input) {
          input.value = p[Number(input.getAttribute("data-day"))] || "";
        });
      });
    });
    m.querySelector('[data-act="cancel"]').addEventListener("click", OD.ui.closeModal);
    m.querySelector('[data-act="save"]').addEventListener("click", function () {
      var out = {};
      m.querySelectorAll("[data-day]").forEach(function (input) {
        out[Number(input.getAttribute("data-day"))] = input.value.trim();
      });
      OD.db.routine.days = out;
      OD.store.save();
      OD.ui.closeModal();
      OD.app.refresh();
      OD.ui.toast("Routine saved — it guides, it doesn't nag.");
    });
  }

  /* ---------- workout logging (dynamic exercise rows) ---------- */

  function exerciseRow(e) {
    e = e || {};
    return '<div class="ex-row">' +
      '<input class="control" data-ex="name" value="' + esc(e.exercise || "") + '" placeholder="Bench press">' +
      '<input class="control" data-ex="sets" type="number" min="0" value="' + esc(e.sets || "") + '" placeholder="Sets">' +
      '<input class="control" data-ex="reps" type="number" min="0" value="' + esc(e.reps || "") + '" placeholder="Reps">' +
      '<input class="control" data-ex="weight" type="number" min="0" step="0.5" value="' + esc(e.weight || "") + '" placeholder="Weight">' +
      '<button class="btn sm ghost" data-ex="del" type="button" title="Remove">×</button>' +
      "</div>";
  }

  function workoutForm(w) {
    var unit = (OD.db.settings.units || {}).weight || "lb";
    var entries = (w && w.entries) || [{}, {}, {}];

    var m = OD.ui.openModal(
      OD.ui.modalHead(w ? "Edit workout" : "Log a workout") +
      '<div class="form-grid">' +
      '<div class="field"><label for="wo-date">Date</label><input class="control" id="wo-date" type="date" value="' + esc((w && w.date) || OD.todayISO()) + '"></div>' +
      '<div class="field"><label for="wo-label">What was it?</label><input class="control" id="wo-label" value="' + esc((w && w.label) || OD.goals.plannedLabel(OD.todayISO()) || "") + '" placeholder="Push day, run, hockey…"></div>' +
      '<div class="field"><label for="wo-kind">Type</label><select class="control" id="wo-kind">' +
      '<option value="lift"' + (!w || w.kind === "lift" ? " selected" : "") + ">Lifting</option>" +
      '<option value="cardio"' + (w && w.kind === "cardio" ? " selected" : "") + ">Cardio / other</option>" +
      "</select></div>" +
      '<div class="field"><label for="wo-min">Minutes (for cardio)</label><input class="control" id="wo-min" type="number" min="0" value="' + esc((w && w.minutes) || "") + '"></div>' +
      "</div>" +
      '<div class="card-title" style="margin-top:16px">Exercises <span class="right hint">weight in ' + unit + "</span></div>" +
      '<div class="ex-head"><span>Exercise</span><span>Sets</span><span>Reps</span><span>Weight</span><span></span></div>' +
      '<div id="ex-rows">' + entries.map(exerciseRow).join("") + "</div>" +
      '<button class="btn sm" id="ex-add" type="button" style="margin-top:8px">+ Add exercise</button>' +
      '<div class="field" style="margin-top:12px"><label for="wo-notes">Notes</label>' +
      '<input class="control" id="wo-notes" value="' + esc((w && w.notes) || "") + '" placeholder="Optional — how it felt, what to try next time"></div>' +
      '<div class="modal-actions">' +
      (w ? '<button class="btn danger" data-act="delete" type="button">Delete</button>' : "") +
      '<button class="btn" data-act="cancel" type="button">Cancel</button>' +
      '<button class="btn primary" data-act="save" type="button">Save workout</button></div>'
    );

    var rowsEl = m.querySelector("#ex-rows");
    function wireRow(row) {
      row.querySelector('[data-ex="del"]').addEventListener("click", function () { row.remove(); });
    }
    rowsEl.querySelectorAll(".ex-row").forEach(wireRow);
    m.querySelector("#ex-add").addEventListener("click", function () {
      rowsEl.insertAdjacentHTML("beforeend", exerciseRow());
      wireRow(rowsEl.lastElementChild);
      rowsEl.lastElementChild.querySelector('[data-ex="name"]').focus();
    });

    m.querySelector('[data-act="cancel"]').addEventListener("click", OD.ui.closeModal);
    if (w) {
      m.querySelector('[data-act="delete"]').addEventListener("click", function () {
        OD.ui.confirm({ title: "Delete workout?", message: OD.fmt.dateFull(w.date) + " · " + (w.label || w.kind) }, function () {
          OD.db.workouts = OD.db.workouts.filter(function (x) { return x.id !== w.id; });
          OD.store.save();
          OD.app.refresh();
        });
      });
    }
    m.querySelector('[data-act="save"]').addEventListener("click", function () {
      var entries = [];
      rowsEl.querySelectorAll(".ex-row").forEach(function (row) {
        var name = row.querySelector('[data-ex="name"]').value.trim();
        if (!name) return;
        entries.push({
          exercise: name,
          sets: Number(row.querySelector('[data-ex="sets"]').value) || 0,
          reps: Number(row.querySelector('[data-ex="reps"]').value) || 0,
          weight: Number(row.querySelector('[data-ex="weight"]').value) || 0
        });
      });
      var data = {
        date: m.querySelector("#wo-date").value || OD.todayISO(),
        label: m.querySelector("#wo-label").value.trim() || (m.querySelector("#wo-kind").value === "cardio" ? "Cardio" : "Workout"),
        kind: m.querySelector("#wo-kind").value,
        minutes: Number(m.querySelector("#wo-min").value) || 0,
        entries: entries,
        notes: m.querySelector("#wo-notes").value.trim()
      };
      if (w) Object.assign(w, data);
      else { data.id = OD.uid(); OD.db.workouts.push(data); }
      OD.store.save();
      OD.ui.closeModal();
      OD.app.refresh();
      OD.ui.toast("Workout logged. Showed up — that's the 1%.");
    });
  }

  /* ---------- weigh-ins ---------- */

  function weighForm(entry) {
    var unit = (OD.db.settings.units || {}).weight || "lb";
    OD.ui.form({
      title: entry ? "Edit weigh-in" : "Weigh-in",
      values: entry ? { date: entry.date, weight: Math.round((unit === "kg" ? entry.weightKg : OD.units.kgToLb(entry.weightKg)) * 10) / 10 } : null,
      fields: [
        { key: "date", label: "Date", type: "date", required: true, default: OD.todayISO() },
        { key: "weight", label: "Weight (" + unit + ")", type: "number", step: "0.1", required: true,
          hint: "Same scale, same time of day — the trend matters, single days don't." }
      ],
      onSubmit: function (v) {
        var kg = unit === "kg" ? Number(v.weight) : OD.units.lbToKg(Number(v.weight));
        if (entry) { entry.date = v.date; entry.weightKg = kg; }
        else OD.db.weighins.push({ id: OD.uid(), date: v.date, weightKg: kg });
        OD.store.save();
        OD.app.refresh();
      },
      onDelete: entry && function () {
        OD.db.weighins = OD.db.weighins.filter(function (x) { return x.id !== entry.id; });
        OD.store.save();
        OD.app.refresh();
      }
    });
  }

  /* ---------- computed: PRs & week ---------- */

  function personalRecords() {
    var best = {};
    OD.db.workouts.forEach(function (w) {
      (w.entries || []).forEach(function (e) {
        if (!e.exercise || !e.weight) return;
        var key = e.exercise.toLowerCase();
        var est = e.weight * (1 + (e.reps || 1) / 30); // Epley estimated 1RM
        if (!best[key] || est > best[key].est) {
          best[key] = { exercise: e.exercise, weight: e.weight, reps: e.reps, est: est, date: w.date };
        }
      });
    });
    return Object.keys(best).map(function (k) { return best[k]; })
      .sort(function (a, b) { return b.est - a.est; });
  }

  function weekDates() {
    var out = [];
    var now = new Date();
    var monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    for (var i = 0; i < 7; i++) {
      var d = new Date(monday);
      d.setDate(monday.getDate() + i);
      out.push(d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"));
    }
    return out;
  }

  /* ---------- view ---------- */

  OD.views.fitness = {
    title: "Training",
    actions: function () {
      return [
        { label: "Weigh-in", onClick: function () { weighForm(null); } },
        { label: "Routine", onClick: routineForm },
        { label: "+ Log workout", primary: true, onClick: function () { workoutForm(null); } }
      ];
    },

    render: function (el) {
      var db = OD.db;
      var today = OD.todayISO();
      var planned = OD.goals.plannedLabel(today);
      var isRest = !planned || /^rest$/i.test(planned);
      var todayDone = OD.goals.workoutsOn(today).length > 0;

      var week = weekDates();
      var plannedThisWeek = week.filter(function (d) {
        var p = OD.goals.plannedLabel(d);
        return p && !/^rest$/i.test(p);
      }).length;
      var doneThisWeek = week.filter(function (d) { return OD.goals.workoutsOn(d).length; }).length;

      var latest = db.weighins.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; })[0];
      var monthAgoISO = OD.goals.dayISO(-30);
      var old = db.weighins.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; })
        .find(function (x) { return x.date <= monthAgoISO; });
      var deltaTxt = "";
      if (latest && old) {
        var d = latest.weightKg - old.weightKg;
        deltaTxt = (d <= 0 ? "▼ " : "▲ ") + OD.units.weight(Math.abs(d)) + " in 30 days";
      }

      var prs = personalRecords();

      var html = '<div class="tiles">' +
        '<div class="tile"><div class="tile-label">Today</div><div class="tile-value" style="font-size:20px">' +
        esc(OD.goals.routineActive() ? (isRest ? "Rest day" : planned) : "No routine yet") + "</div>" +
        '<div class="tile-delta ' + (todayDone ? "up" : "") + '">' + (todayDone ? "✓ trained" : (isRest ? "recovery counts" : "not yet")) + "</div></div>" +
        '<div class="tile"><div class="tile-label">This week</div><div class="tile-value">' + doneThisWeek +
        (plannedThisWeek ? " <small>of " + plannedThisWeek + " planned</small>" : " <small>sessions</small>") + "</div></div>" +
        '<div class="tile"><div class="tile-label">Body weight</div><div class="tile-value" style="font-size:22px">' +
        (latest ? esc(OD.units.weight(latest.weightKg)) : "—") + "</div>" +
        (deltaTxt ? '<div class="tile-delta">' + esc(deltaTxt) + "</div>" : "") + "</div>" +
        '<div class="tile"><div class="tile-label">Exercises with PRs</div><div class="tile-value">' + prs.length + "</div></div>" +
        "</div>";

      /* routine strip */
      var days = db.routine.days || {};
      var strip = [1, 2, 3, 4, 5, 6, 0].map(function (i) {
        var label = (days[i] || "").trim() || "Rest";
        var iso = week[(i + 6) % 7];
        var did = OD.goals.workoutsOn(iso).length > 0;
        var isToday = iso === today;
        return '<div class="week-day' + (isToday ? " today" : "") + '">' +
          '<span class="week-name">' + DAY_NAMES[i].slice(0, 3) + "</span>" +
          '<span class="week-label">' + esc(label) + "</span>" +
          '<span class="week-mark">' + (did ? "✓" : "") + "</span></div>";
      }).join("");
      html += '<div class="card section-gap"><div class="card-title">The week ' +
        '<button class="btn sm ghost right" id="fit-routine" type="button">Edit routine</button></div>' +
        '<div class="week-strip">' + strip + "</div>" +
        (OD.goals.routineActive() ? "" : '<p class="hint" style="margin-top:10px">Set a routine and the dashboard starts counting showing up — pick a preset like Push/Pull/Legs or name your own days.</p>') +
        "</div>";

      /* weight trend + PRs */
      var prRows = prs.slice(0, 8).map(function (p) {
        return "<tr><td><b>" + esc(p.exercise) + "</b></td>" +
          '<td class="num">' + esc(p.weight) + " × " + esc(p.reps) + "</td>" +
          '<td class="num">' + esc(Math.round(p.est)) + "</td>" +
          '<td class="fade">' + esc(OD.fmt.date(p.date)) + "</td></tr>";
      }).join("");

      html += '<div class="grid grid-2 section-gap">' +
        '<div class="card"><div class="card-title">Body weight <span class="right hint">click Weigh-in above to add</span></div><div id="fit-weight"></div></div>' +
        '<div class="card"><div class="card-title">Personal records <span class="right hint">best estimated 1RM per exercise</span></div>' +
        OD.ui.table(["Exercise", { label: "Best set", cls: "num" }, { label: "Est. 1RM", cls: "num" }, "When"], prRows, "Log lifting workouts and PRs appear on their own.") +
        "</div></div>";

      /* workout history */
      var woRows = db.workouts
        .slice()
        .sort(function (a, b) { return a.date < b.date ? 1 : -1; })
        .slice(0, 20)
        .map(function (w) {
          var summary = w.kind === "cardio"
            ? (w.minutes ? w.minutes + " min" : "—")
            : (w.entries || []).length + " exercises";
          return '<tr class="clickable" data-workout="' + w.id + '">' +
            "<td>" + esc(OD.fmt.date(w.date)) + "</td>" +
            "<td><b>" + esc(w.label) + "</b></td>" +
            "<td>" + OD.ui.badge(w.kind === "cardio" ? "cardio" : "lifting", w.kind === "cardio" ? "accent" : "good") + "</td>" +
            '<td class="fade">' + esc(summary) + "</td>" +
            '<td class="fade">' + esc(w.notes || "") + "</td></tr>";
        }).join("");

      html += '<div class="card section-gap"><div class="card-title">Workout log <span class="right hint">click to edit</span></div>' +
        OD.ui.table(["Date", "Workout", "Type", "Volume", "Notes"], woRows, "Log the first one — even a walk counts.") + "</div>";

      el.innerHTML = html;

      /* charts */
      var wPts = db.weighins
        .slice()
        .sort(function (a, b) { return a.date < b.date ? -1 : 1; })
        .map(function (x) {
          var v = (db.settings.units.weight === "kg") ? x.weightKg : OD.units.kgToLb(x.weightKg);
          return { label: OD.fmt.date(x.date), value: Math.round(v * 10) / 10 };
        });
      OD.charts.line(el.querySelector("#fit-weight"), {
        points: wPts,
        height: 170,
        emptyMsg: "Two weigh-ins make a trend line.",
        ariaLabel: "Body weight trend"
      });

      /* wiring */
      el.querySelector("#fit-routine").addEventListener("click", routineForm);
      el.querySelectorAll("[data-workout]").forEach(function (r) {
        r.addEventListener("click", function () {
          workoutForm(db.workouts.find(function (w) { return w.id === r.getAttribute("data-workout"); }));
        });
      });
    }
  };

  /* command-palette hooks */
  OD.views.fitness.newWorkout = function () { workoutForm(null); };
  OD.views.fitness.newWeighin = function () { weighForm(null); };
  OD.views.fitness.openWorkout = function (id) {
    var w = OD.db.workouts.find(function (x) { return x.id === id; });
    if (w) workoutForm(w);
  };
})();
