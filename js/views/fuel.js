/* OpsDesk — Fuel: the calorie plan maker and daily macro + supplement log.
   Philosophy: one honest entry a day beats a perfect diary you quit.
   The plan is computed from your stats (Mifflin-St Jeor), explained in
   plain words, and scoring is tolerant — ±10% on calories is a hit. */
(function () {
  "use strict";

  var esc = function (s) { return OD.ui.esc(s); };

  var ACTIVITY = [
    { value: "1.2", label: "Mostly sitting (desk day, little exercise)" },
    { value: "1.375", label: "Lightly active (walks, 1–3 workouts/week)" },
    { value: "1.55", label: "Active (3–5 workouts/week)" },
    { value: "1.725", label: "Very active (hard training most days)" }
  ];
  var GOALS = [
    { value: "cut", label: "Lose fat (about −20% calories)" },
    { value: "maintain", label: "Maintain (stay where I am)" },
    { value: "gain", label: "Build muscle (about +10% calories)" }
  ];

  /* ---------- the plan maker ---------- */

  function computePlan(stats) {
    var kg = stats.weightKg, cm = stats.heightCm;
    var bmr = 10 * kg + 6.25 * cm - 5 * stats.age + (stats.sex === "male" ? 5 : -161);
    var tdee = bmr * Number(stats.activity);
    var kcal = tdee * (stats.goal === "cut" ? 0.8 : stats.goal === "gain" ? 1.1 : 1);
    var protein = 1.8 * kg;                    // ≈ 0.8 g per lb — muscle-keeping territory
    var fat = (kcal * 0.25) / 9;               // 25% of calories
    var carbs = (kcal - protein * 4 - fat * 9) / 4;
    var r5 = function (n) { return Math.max(0, Math.round(n / 5) * 5); };
    return { kcal: r5(kcal), protein: r5(protein), fat: r5(fat), carbs: r5(carbs), stats: stats };
  }

  function planForm() {
    // pick units first so the form can ask in the numbers you actually know
    var m = OD.ui.openModal(
      OD.ui.modalHead("Make my plan") +
      '<p class="subtle">Four questions, then OpsDesk works out daily calories and macros for you — and explains why.</p>' +
      '<div class="stack-choices" style="margin-top:12px">' +
      '<button class="big-choice" data-u="lb" type="button"><b>Pounds & feet</b><span>Weight in lb, height in ft + in</span></button>' +
      '<button class="big-choice" data-u="kg" type="button"><b>Kilograms & centimetres</b><span>Metric all the way</span></button>' +
      "</div>", true
    );
    m.querySelectorAll(".big-choice").forEach(function (b) {
      b.addEventListener("click", function () {
        var u = b.getAttribute("data-u");
        OD.ui.closeModal();
        statsForm(u);
      });
    });
  }

  function statsForm(unit) {
    var prev = (OD.db.fuelPlan && OD.db.fuelPlan.stats) || {};
    var fields = [
      { key: "sex", label: "Body", type: "select", options: [{ value: "male", label: "Male" }, { value: "female", label: "Female" }], required: true },
      { key: "age", label: "Age", type: "number", required: true }
    ];
    if (unit === "lb") {
      fields.push({ key: "hft", label: "Height — feet", type: "number", required: true, default: prev.heightCm ? Math.floor(prev.heightCm / 2.54 / 12) : "" });
      fields.push({ key: "hin", label: "Height — inches", type: "number", default: prev.heightCm ? Math.round(prev.heightCm / 2.54 % 12) : "" });
      fields.push({ key: "weight", label: "Weight (lb)", type: "number", step: "0.1", required: true, default: prev.weightKg ? Math.round(OD.units.kgToLb(prev.weightKg)) : "" });
    } else {
      fields.push({ key: "hcm", label: "Height (cm)", type: "number", required: true, default: prev.heightCm || "" });
      fields.push({ key: "weight", label: "Weight (kg)", type: "number", step: "0.1", required: true, default: prev.weightKg ? Math.round(prev.weightKg * 10) / 10 : "" });
    }
    fields.push({ key: "activity", label: "A normal week looks like", type: "select", options: ACTIVITY, required: true, span2: true, default: prev.activity || "1.375" });
    fields.push({ key: "goal", label: "Right now I want to", type: "select", options: GOALS, required: true, span2: true, default: prev.goal || "cut" });

    OD.ui.form({
      title: "About you",
      values: { sex: prev.sex || "male", age: prev.age || "" },
      fields: fields,
      validate: function (v) {
        if (v.age < 14 || v.age > 100) return "Age needs to be 14–100.";
        return "";
      },
      onSubmit: function (v) {
        var stats = {
          sex: v.sex, age: v.age,
          activity: v.activity, goal: v.goal,
          heightCm: unit === "lb" ? Math.round((Number(v.hft) * 12 + (Number(v.hin) || 0)) * 2.54) : Number(v.hcm),
          weightKg: unit === "lb" ? OD.units.lbToKg(Number(v.weight)) : Number(v.weight)
        };
        OD.db.settings.units.weight = unit === "lb" ? "lb" : "kg";
        OD.db.fuelPlan = computePlan(stats);
        // a plan implies a starting weight — log it if there's no weigh-in yet
        if (!OD.db.weighins.length) {
          OD.db.weighins.push({ id: OD.uid(), date: OD.todayISO(), weightKg: stats.weightKg });
        }
        OD.store.save();
        OD.app.refresh();
        OD.ui.toast("Plan ready — aim for it most days, not every day.");
      }
    });
  }

  function manualTargetsForm() {
    var p = OD.db.fuelPlan || {};
    OD.ui.form({
      title: "Set targets myself",
      values: { kcal: p.kcal, protein: p.protein, fat: p.fat, carbs: p.carbs },
      fields: [
        { key: "protein", label: "Protein (g/day)", type: "number", required: true },
        { key: "fat", label: "Fat (g/day)", type: "number", required: true },
        { key: "carbs", label: "Carbs (g/day)", type: "number", required: true },
        { key: "kcal", label: "Calories (blank = from macros)", type: "number" }
      ],
      onSubmit: function (v) {
        var kcal = v.kcal || Math.round(v.protein * 4 + v.carbs * 4 + v.fat * 9);
        OD.db.fuelPlan = { kcal: kcal, protein: v.protein, fat: v.fat, carbs: v.carbs, stats: (OD.db.fuelPlan || {}).stats || null };
        OD.store.save();
        OD.app.refresh();
        OD.ui.toast("Targets saved.");
      }
    });
  }

  /* ---------- the daily log ---------- */

  function logForm(dateISO) {
    var date = dateISO || OD.todayISO();
    var existing = OD.goals.fuelLogFor(date);
    var suppFields = OD.db.supps.map(function (s) {
      return {
        key: "supp_" + s.id, label: s.name + (s.dose ? " · " + s.dose : ""), type: "select",
        options: [{ value: "no", label: "Not yet" }, { value: "yes", label: "Taken ✓" }],
        default: existing && existing.supps && existing.supps[s.id] ? "yes" : "no"
      };
    });

    OD.ui.form({
      title: (existing ? "Edit " : "Log ") + OD.fmt.dateFull(date),
      values: existing ? { protein: existing.protein, fat: existing.fat, carbs: existing.carbs, note: existing.note } : null,
      fields: [
        { key: "protein", label: "Protein (g)", type: "number", required: true },
        { key: "carbs", label: "Carbs (g)", type: "number", required: true },
        { key: "fat", label: "Fat (g)", type: "number", required: true },
        { key: "note", label: "Note", placeholder: "Optional" }
      ].concat(suppFields),
      onSubmit: function (v) {
        var supps = {};
        OD.db.supps.forEach(function (s) { if (v["supp_" + s.id] === "yes") supps[s.id] = true; });
        var data = { date: date, protein: v.protein, carbs: v.carbs, fat: v.fat, note: v.note, supps: supps };
        if (existing) Object.assign(existing, data);
        else { data.id = OD.uid(); OD.db.fuelLogs.push(data); }
        OD.store.save();
        OD.app.refresh();
        var kcal = OD.goals.kcalOf(data);
        OD.ui.toast("Logged — " + kcal + " kcal, " + v.protein + " g protein.");
      },
      onDelete: existing && function () {
        OD.ui.confirm({ title: "Delete this day's log?", message: OD.fmt.dateFull(date) }, function () {
          OD.db.fuelLogs = OD.db.fuelLogs.filter(function (l) { return l.id !== existing.id; });
          OD.store.save();
          OD.app.refresh();
        });
      }
    });
  }

  function suppForm(s) {
    OD.ui.form({
      title: s ? "Edit supplement" : "Add supplement",
      values: s,
      fields: [
        { key: "name", label: "Name", required: true, placeholder: "Creatine" },
        { key: "dose", label: "Dose", placeholder: "5 g" }
      ],
      onSubmit: function (v) {
        if (s) Object.assign(s, v);
        else { v.id = OD.uid(); OD.db.supps.push(v); }
        OD.store.save();
        OD.app.refresh();
      },
      onDelete: s && function () {
        OD.ui.confirm({ title: "Remove supplement?", message: s.name + " — past logs keep their history." }, function () {
          OD.db.supps = OD.db.supps.filter(function (x) { return x.id !== s.id; });
          OD.store.save();
          OD.app.refresh();
        });
      }
    });
  }

  /* ---------- view ---------- */

  OD.views.fuel = {
    title: "Fuel",
    actions: function () {
      return [
        { label: "+ Supplement", onClick: function () { suppForm(null); } },
        { label: "+ Log today", primary: true, onClick: function () { logForm(null); } }
      ];
    },

    render: function (el) {
      var db = OD.db;
      var plan = db.fuelPlan;
      var today = OD.todayISO();
      var log = OD.goals.fuelLogFor(today);

      var html = "";

      if (!plan) {
        html += '<div class="card" style="text-align:center;padding:34px 20px">' +
          '<h3 style="font-size:17px;margin-bottom:6px">Start with a plan</h3>' +
          '<p class="subtle" style="max-width:52ch;margin:0 auto 16px">Answer four questions and OpsDesk calculates daily calories, protein, carbs, and fat for your goal — then every day you log gets checked against it, with a ±10% grace so one meal never ruins a day.</p>' +
          '<div class="row" style="justify-content:center"><button class="btn primary" id="fuel-make-plan" type="button">Make my plan</button>' +
          '<button class="btn" id="fuel-manual" type="button">I know my targets</button></div></div>';
      } else {
        var kcalNow = log ? OD.goals.kcalOf(log) : 0;
        function macroTile(label, now, target, unit) {
          var pct = target ? Math.min(100, (now / target) * 100) : 0;
          return '<div class="tile"><div class="tile-label">' + esc(label) + '</div>' +
            '<div class="tile-value">' + esc(OD.fmt.num(now)) + ' <small>/ ' + esc(OD.fmt.num(target)) + " " + unit + "</small></div>" +
            '<div style="margin-top:8px">' + OD.charts.meter(pct) + "</div></div>";
        }
        var suppsDone = OD.db.supps.filter(function (s) { return log && log.supps && log.supps[s.id]; }).length;
        html += '<div class="tiles">' +
          macroTile("Calories today", kcalNow, plan.kcal, "kcal") +
          macroTile("Protein", log ? Number(log.protein) : 0, plan.protein, "g") +
          macroTile("Carbs", log ? Number(log.carbs) : 0, plan.carbs, "g") +
          macroTile("Fat", log ? Number(log.fat) : 0, plan.fat, "g") +
          '<div class="tile"><div class="tile-label">Supplements</div><div class="tile-value">' + suppsDone + " <small>of " + db.supps.length + " taken</small></div>" +
          '<div style="margin-top:8px">' + OD.charts.meter(db.supps.length ? (suppsDone / db.supps.length) * 100 : 0) + "</div></div>" +
          "</div>";

        var why = "";
        if (plan.stats) {
          var g = plan.stats.goal;
          why = '<p class="hint" style="margin-top:10px">Built for <b>' +
            (g === "cut" ? "losing fat" : g === "gain" ? "building muscle" : "maintaining") +
            "</b> at " + OD.units.weight(plan.stats.weightKg) + ". Protein is set near 0.8 g per lb to " +
            (g === "cut" ? "hold onto muscle while calories are down" : "give training something to build with") +
            "; fat covers hormones at ~25% of calories; carbs fill the rest for energy. A day counts as on-plan within ±10% of calories with protein at 90%+.</p>";
        }
        html += '<div class="card section-gap"><div class="card-title">The plan ' +
          '<span class="right"><button class="btn sm ghost" id="fuel-make-plan" type="button">Recalculate</button>' +
          '<button class="btn sm ghost" id="fuel-manual" type="button">Edit targets</button></span></div>' +
          '<div class="row" style="gap:18px;font-size:14px"><span><b>' + OD.fmt.num(plan.kcal) + "</b> kcal</span>" +
          "<span><b>" + OD.fmt.num(plan.protein) + " g</b> protein</span>" +
          "<span><b>" + OD.fmt.num(plan.carbs) + " g</b> carbs</span>" +
          "<span><b>" + OD.fmt.num(plan.fat) + " g</b> fat</span></div>" + why + "</div>";
      }

      /* supplements list */
      var suppRows = db.supps.map(function (s) {
        var takenToday = log && log.supps && log.supps[s.id];
        return '<tr class="clickable" data-supp="' + s.id + '"><td><b>' + esc(s.name) + "</b></td>" +
          '<td class="fade">' + esc(s.dose || "—") + "</td>" +
          "<td>" + (takenToday ? OD.ui.badge("taken today", "good") : OD.ui.badge("not yet", "plain")) + "</td></tr>";
      }).join("");

      /* last 14 days */
      var histRows = "";
      for (var i = 0; i < 14; i++) {
        var d = OD.goals.dayISO(-i);
        var l = OD.goals.fuelLogFor(d);
        if (!l && i > 0) continue;
        var kcal = l ? OD.goals.kcalOf(l) : 0;
        var statusBadge;
        if (!l) statusBadge = OD.ui.badge("not logged", "plain");
        else if (!plan) statusBadge = OD.ui.badge("logged", "accent");
        else {
          var ms = OD.goals.macroScore(l);
          statusBadge = ms.score >= 0.99 ? OD.ui.badge("on plan", "good")
            : ms.score >= 0.5 ? OD.ui.badge("close · " + Math.round(ms.score * 100) + "%", "warning")
            : OD.ui.badge("off plan · " + Math.round(ms.score * 100) + "%", "plain");
        }
        histRows += '<tr class="clickable" data-log-date="' + d + '">' +
          "<td>" + esc(OD.fmt.date(d)) + (i === 0 ? ' <span class="hint">today</span>' : "") + "</td>" +
          '<td class="num">' + (l ? esc(OD.fmt.num(kcal)) : "—") + "</td>" +
          '<td class="num">' + (l ? esc(l.protein) : "—") + "</td>" +
          '<td class="num">' + (l ? esc(l.carbs) : "—") + "</td>" +
          '<td class="num">' + (l ? esc(l.fat) : "—") + "</td>" +
          "<td>" + statusBadge + "</td></tr>";
      }

      html += '<div class="grid grid-2 section-gap">' +
        '<div class="card"><div class="card-title">Supplements <span class="right hint">tick them off in the daily log</span></div>' +
        OD.ui.table(["Supplement", "Dose", "Today"], suppRows, "Add creatine, vitamins — whatever you take daily.") + "</div>" +
        '<div class="card"><div class="card-title">Last 14 days <span class="right hint">click a day to edit</span></div>' +
        OD.ui.table(["Day", { label: "kcal", cls: "num" }, { label: "P", cls: "num" }, { label: "C", cls: "num" }, { label: "F", cls: "num" }, "Status"], histRows, "Log your first day — takes 20 seconds.") +
        "</div></div>";

      el.innerHTML = html;

      /* wiring */
      var mk = el.querySelector("#fuel-make-plan");
      if (mk) mk.addEventListener("click", planForm);
      var man = el.querySelector("#fuel-manual");
      if (man) man.addEventListener("click", manualTargetsForm);
      el.querySelectorAll("[data-supp]").forEach(function (r) {
        r.addEventListener("click", function () {
          suppForm(db.supps.find(function (s) { return s.id === r.getAttribute("data-supp"); }));
        });
      });
      el.querySelectorAll("[data-log-date]").forEach(function (r) {
        r.addEventListener("click", function () { logForm(r.getAttribute("data-log-date")); });
      });
    }
  };

  /* command-palette hooks */
  OD.views.fuel.logToday = function () { logForm(null); };
  OD.views.fuel.makePlan = function () { planForm(); };
})();
