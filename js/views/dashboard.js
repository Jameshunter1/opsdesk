/* OpsDesk — home: the lean 1% view.
   Score + tap-to-check habits, streak + dots, next actions, recent activity.
   The charts wait behind a Trends toggle — numbers when you want them,
   calm when you don't. */
(function () {
  "use strict";

  var esc = function (s) { return OD.ui.esc(s); };
  var trendsOpen = false;

  /* Habit list manager — rename, add, remove. Checks live on the day chips. */
  function habitsManager() {
    function row(h) {
      return '<div class="row" style="margin-bottom:8px" data-habit-row="' + esc(h.id) + '">' +
        '<input class="control" data-habit-name value="' + esc(h.name) + '" style="flex:1">' +
        '<button class="btn sm ghost" data-habit-del type="button" title="Remove">×</button></div>';
    }
    var m = OD.ui.openModal(
      OD.ui.modalHead("Daily habits") +
      '<p class="subtle">Each habit is one point in your day, checked off by hand on the dashboard. Keep the list short enough to be honest about.</p>' +
      '<div id="habit-rows" style="margin-top:12px">' + OD.db.habits.map(row).join("") + "</div>" +
      '<button class="btn sm" id="habit-add" type="button">+ Add habit</button>' +
      '<div class="modal-actions"><button class="btn" data-act="cancel" type="button">Cancel</button>' +
      '<button class="btn primary" data-act="save" type="button">Save</button></div>',
      true
    );
    var rows = m.querySelector("#habit-rows");
    function wire(r) {
      r.querySelector("[data-habit-del]").addEventListener("click", function () { r.remove(); });
    }
    rows.querySelectorAll("[data-habit-row]").forEach(wire);
    m.querySelector("#habit-add").addEventListener("click", function () {
      rows.insertAdjacentHTML("beforeend", row({ id: OD.uid(), name: "" }));
      var r = rows.lastElementChild;
      wire(r);
      r.querySelector("[data-habit-name]").focus();
    });
    m.querySelector('[data-act="cancel"]').addEventListener("click", OD.ui.closeModal);
    m.querySelector('[data-act="save"]').addEventListener("click", function () {
      var out = [];
      rows.querySelectorAll("[data-habit-row]").forEach(function (r) {
        var name = r.querySelector("[data-habit-name]").value.trim();
        if (name) out.push({ id: r.getAttribute("data-habit-row"), name: name });
      });
      OD.db.habits = out;
      OD.store.save();
      OD.ui.closeModal();
      OD.app.refresh();
      OD.ui.toast(out.length ? "Habits saved — they score one point each." : "No habits — the score runs on your logs alone.");
    });
  }

  function bestStreak(days) {
    var best = 0, run = 0;
    for (var i = days; i >= 1; i--) {
      if (OD.goals.dayTone(OD.goals.dayISO(-i)) === "good") { run++; if (run > best) best = run; }
      else run = 0;
    }
    return best;
  }

  function activityFeed() {
    var items = [];
    OD.db.tickets.forEach(function (t) {
      if (t.resolved) items.push({ date: t.resolved, tag: OD.viewLabel("tasks"), tone: "good", text: "Done " + t.num + " — " + t.title });
      else if (t.opened) items.push({ date: t.opened, tag: OD.viewLabel("tasks"), tone: "warning", text: "Added " + t.num + " — " + t.title });
    });
    OD.db.workouts.forEach(function (w) {
      var extra = w.kind === "cardio" ? (w.minutes ? w.minutes + " min" : "") : (w.entries || []).length + " exercises";
      items.push({ date: w.date, tag: OD.viewLabel("fitness"), tone: "good", text: w.label + (extra ? " · " + extra : "") });
    });
    OD.db.fuelLogs.forEach(function (l) {
      items.push({ date: l.date, tag: OD.viewLabel("fuel"), tone: "accent", text: OD.goals.kcalOf(l) + " kcal · " + l.protein + " g protein" });
    });
    OD.db.studyLogs.forEach(function (l) {
      items.push({ date: l.date, tag: OD.viewLabel("study"), tone: "plain", text: (l.what || "Study") + " · " + l.minutes + " min" });
    });
    OD.db.weighins.forEach(function (x) {
      items.push({ date: x.date, tag: OD.viewLabel("fitness"), tone: "plain", text: "Weigh-in · " + OD.units.weight(x.weightKg) });
    });
    OD.db.projects.forEach(function (p) {
      (p.tasks || []).forEach(function (t) {
        if (t.done && t.doneDate) items.push({ date: t.doneDate, tag: OD.viewLabel("tasks"), tone: "good", text: p.name + " — " + t.text });
      });
    });
    items.sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    return items.slice(0, 8);
  }

  OD.views.dashboard = {
    title: "Dashboard",
    actions: function () { return []; },

    render: function (el) {
      var db = OD.db;
      var today = OD.todayISO();
      var score = OD.goals.dayScore(today);

      var now = new Date();
      var hi = now.getHours() < 12 ? "Good morning" : now.getHours() < 17 ? "Good afternoon" : "Good evening";
      var who = (db.settings.name || "").trim();
      var html = '<div class="greeting spread">' +
        "<h2>" + esc(hi + (who ? ", " + who : "")) + ".</h2>" +
        '<span class="hint">' + esc(now.toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric" })) + "</span>" +
        "</div>";

      if (db.settings.seeded && !db.settings.bannerDismissed) {
        html += '<div class="banner" style="margin-bottom:14px">' +
          "<span>You're looking at <b>sample data</b>. Edit anything, or start clean in Settings.</span>" +
          '<button class="btn sm right" data-act="dismiss-banner" type="button">Got it</button></div>';
      }

      var pctToday = Math.round(score.ratio * 100);
      var barPct = Math.round(OD.goals.greenBar() * 100);
      var streak = OD.goals.streak();
      var best = bestStreak(180);

      var chips = score.parts.map(function (p) {
        var cls = "score-chip" + (p.ok ? " ok" : p.score > 0.1 ? " mid" : "");
        var icon = p.ok ? "✓ " : p.score > 0.1 ? "◐ " : "· ";
        var extra = "";
        if (p.score > 1.001) extra = ' <span class="hint">· +' + Math.round((p.score - 1) * 100) + "% bonus</span>";
        else if (p.detail && !p.ok) extra = ' <span class="hint">· ' + esc(p.detail) + "</span>";
        else if (p.ok && p.detail && p.key !== "habit") extra = ' <span class="hint">· ' + esc(p.detail) + "</span>";
        var inner = icon + esc(p.label) + extra;
        if (p.key === "habit") {
          return '<button type="button" class="' + cls + ' habit-chip" data-habit="' + esc(p.habitId) + '" title="Tap to toggle">' + inner + "</button>";
        }
        return '<span class="' + cls + '">' + inner + "</span>";
      }).join("");

      var missing = [];
      if (OD.moduleOn("fuel") && !db.fuelPlan) missing.push('<a href="#/fuel">food plan</a>');
      if (OD.moduleOn("fitness") && !OD.goals.routineActive()) missing.push('<a href="#/fitness">workout routine</a>');
      if (OD.moduleOn("study") && !(db.studyPlan.target > 0)) missing.push('<a href="#/study">study target</a>');

      var dots = [];
      for (var i = 13; i >= 0; i--) {
        var dIso = OD.goals.dayISO(-i);
        var s2 = i === 0 ? score : OD.goals.dayScore(dIso);
        var tone = !s2.possible ? "off" : s2.ratio >= OD.goals.greenBar() ? "good" : s2.earned > 0.1 ? "warn" : "off";
        dots.push({ tone: tone, title: OD.fmt.date(dIso) + " — " + Math.round(s2.ratio * 100) + "%" + (i === 0 ? " so far" : "") });
      }

      html += '<div class="grid grid-2">' +
        '<div class="card"><div class="card-title">Today’s 1% ' +
        '<button class="btn sm ghost right" id="manage-habits" type="button">Habits</button></div>' +
        '<div class="score-big">' + pctToday + '%<small> · ' + (Math.round(score.earned * 10) / 10) + " of " + score.possible + " pts</small></div>" +
        '<div style="margin:8px 0 12px">' + OD.charts.meter(pctToday) + "</div>" +
        '<div class="score-chips">' + chips + "</div>" +
        (missing.length ? '<p class="hint" style="margin-top:10px">Add more signal: ' + missing.join(" · ") + ".</p>" : "") +
        "</div>" +

        '<div class="card"><div class="card-title">Consistency</div>' +
        '<div class="row" style="gap:22px;align-items:baseline">' +
        '<div><div class="score-big">' + streak + '<small> day streak</small></div>' +
        '<div class="hint">best ' + best + " in the last 6 months</div></div>" +
        "</div>" +
        '<div style="margin-top:14px">' + OD.charts.dayDots(dots) + "</div>" +
        '<p class="hint" style="margin-top:8px">Last 14 days · green = kept (' + barPct + '%+ of points) · kept days compound ×1.01</p></div>' +
        "</div>";

      /* trends, tucked away */
      html += '<div class="section-gap">' +
        '<button class="btn ghost" id="trends-toggle" type="button">' + (trendsOpen ? "▾ Trends" : "▸ Trends — compound curve & body weight") + "</button>" +
        (trendsOpen
          ? '<div class="grid grid-2" style="margin-top:10px">' +
            '<div class="card"><div class="card-title">The compound curve — 90 days</div><div id="dash-compound"></div>' +
            '<p class="hint" style="margin-top:8px">A kept day multiplies you by 1% × its score. Days under the bar don’t punish you — they just don’t multiply.</p></div>' +
            (OD.moduleOn("fitness") ? '<div class="card"><div class="card-title">Body weight</div><div id="dash-weight"></div></div>' : "") +
            "</div>"
          : "") +
        "</div>";

      /* next actions + activity */
      var nexts = OD.moduleOn("tasks") && OD.views.tasks ? OD.views.tasks.nextActions() : [];
      var open = OD.query.openTickets();
      var nextRows = nexts.slice(0, 5).map(function (n) {
        return '<div class="feed-item clickable" data-goto="#/tasks" style="cursor:pointer"><span class="feed-tag">' + OD.ui.badge(n.project, "accent") + "</span><span>" + esc(n.text) + "</span></div>";
      }).join("");
      open.slice()
        .sort(function (a, b) { var r = { high: 0, medium: 1, low: 2 }; return r[a.priority] - r[b.priority]; })
        .slice(0, Math.max(0, 5 - nexts.length))
        .forEach(function (t) {
          nextRows += '<div class="feed-item clickable" data-goto="#/tasks" style="cursor:pointer"><span class="feed-tag">' +
            OD.ui.badge(t.num, t.priority === "high" ? "critical" : "plain") + "</span><span>" + esc(t.title) + "</span></div>";
        });

      var feed = activityFeed().map(function (f) {
        return '<div class="feed-item"><span class="feed-date">' + esc(OD.fmt.date(f.date)) + "</span>" +
          '<span class="feed-tag">' + OD.ui.badge(f.tag, f.tone) + "</span><span>" + esc(f.text) + "</span></div>";
      }).join("");

      html += '<div class="grid grid-2 section-gap">' +
        '<div class="card"><div class="card-title">Next actions <span class="right hint">one step each</span></div>' +
        (nextRows ? '<div class="feed">' + nextRows + "</div>" : '<div class="empty">Add a project or a to-do in Tasks and its next step lands here.</div>') + "</div>" +
        '<div class="card"><div class="card-title">Recent activity</div>' +
        (feed ? '<div class="feed">' + feed + "</div>" : '<div class="empty">Everything you log lands here.</div>') +
        "</div></div>";

      el.innerHTML = html;

      /* charts (only when Trends is open) */
      if (trendsOpen) {
        var comp = OD.goals.compound(90);
        OD.charts.line(el.querySelector("#dash-compound"), {
          points: comp.map(function (p) { return { label: OD.fmt.date(p.date), value: Math.round(p.value * 1000) / 1000 }; }),
          height: 170,
          format: function (n) { return "×" + n.toFixed(2); },
          ariaLabel: "Compounding progress curve"
        });
        var wEl = el.querySelector("#dash-weight");
        if (wEl) {
          var wPts = db.weighins
            .slice()
            .sort(function (a, b) { return a.date < b.date ? -1 : 1; })
            .map(function (x) {
              var v = db.settings.units.weight === "kg" ? x.weightKg : OD.units.kgToLb(x.weightKg);
              return { label: OD.fmt.date(x.date), value: Math.round(v * 10) / 10 };
            });
          OD.charts.line(wEl, { points: wPts, height: 170, emptyMsg: "Weigh in twice and the trend appears.", ariaLabel: "Body weight trend" });
        }
      }

      /* wiring */
      var dismiss = el.querySelector('[data-act="dismiss-banner"]');
      if (dismiss) dismiss.addEventListener("click", function () {
        db.settings.bannerDismissed = true;
        OD.store.save();
        OD.app.refresh();
      });
      el.querySelectorAll("[data-goto]").forEach(function (r) {
        r.addEventListener("click", function () { location.hash = r.getAttribute("data-goto"); });
      });
      el.querySelector("#trends-toggle").addEventListener("click", function () {
        trendsOpen = !trendsOpen;
        OD.app.refresh();
      });
      var manage = el.querySelector("#manage-habits");
      if (manage) manage.addEventListener("click", habitsManager);
      el.querySelectorAll("[data-habit]").forEach(function (chip) {
        chip.addEventListener("click", function () {
          OD.goals.toggleHabit(OD.todayISO(), chip.getAttribute("data-habit"));
          OD.store.save();
          OD.app.refresh();
        });
      });
    }
  };

  OD.views.dashboard.manageHabits = habitsManager;
})();
