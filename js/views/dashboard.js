/* OpsDesk — dashboard: the 1%-a-day view.
   Leads with today's auto-computed score, the streak, the consistency strip,
   and the compounding curve. Guidance without micromanagement: only what
   you've configured counts, rest days count as kept, and the next action
   for every project is one line, not a schedule. */
(function () {
  "use strict";

  var esc = function (s) { return OD.ui.esc(s); };

  function tile(label, value, small, delta, deltaDir) {
    return '<div class="tile">' +
      '<div class="tile-label">' + esc(label) + "</div>" +
      '<div class="tile-value">' + esc(value) + (small ? " <small>" + esc(small) + "</small>" : "") + "</div>" +
      (delta ? '<div class="tile-delta ' + (deltaDir || "") + '">' + esc(delta) + "</div>" : "") +
      "</div>";
  }

  function activityFeed() {
    var items = [];
    OD.db.tickets.forEach(function (t) {
      if (t.resolved) items.push({ date: t.resolved, tag: OD.viewLabel("desk"), tone: "good", text: "Resolved " + t.num + " — " + t.title });
      else if (t.opened) items.push({ date: t.opened, tag: OD.viewLabel("desk"), tone: "warning", text: "Opened " + t.num + " — " + t.title });
    });
    OD.db.txns.forEach(function (t) {
      items.push({ date: t.date, tag: OD.viewLabel("ledger"), tone: "accent", text: t.desc + " · " + OD.fmt.money(t.amount) });
    });
    OD.db.jobs.forEach(function (j) {
      (j.activity || []).forEach(function (a) {
        items.push({ date: a.date, tag: OD.viewLabel("pipeline"), tone: "plain", text: j.company + " — " + a.note });
      });
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
        if (t.done && t.doneDate) items.push({ date: t.doneDate, tag: OD.viewLabel("projects"), tone: "good", text: p.name + " — " + t.text });
      });
    });
    items.sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    return items.slice(0, 9);
  }

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
      var id = OD.uid();
      rows.insertAdjacentHTML("beforeend", row({ id: id, name: "" }));
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

  OD.views.dashboard = {
    title: "Dashboard",
    actions: function () { return []; },

    render: function (el) {
      var db = OD.db;
      var simple = OD.isSimple();
      var today = OD.todayISO();
      var score = OD.goals.dayScore(today);
      var configured = score.possible > 0;

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

      /* ---------- setup nudge (once) or the 1% strip ---------- */

      if (!configured) {
        html += '<div class="card" style="text-align:center;padding:30px 20px">' +
          '<h3 style="font-size:17px;margin-bottom:6px">Set up your 1%</h3>' +
          '<p class="subtle" style="max-width:56ch;margin:0 auto 16px">Pick what counts, and every day scores itself from what you log — no ticking boxes, no nagging. Getting 1% better on the days you show up is the whole system.</p>' +
          '<div class="row" style="justify-content:center">' +
          (OD.moduleOn("fuel") ? '<a class="btn" href="#/fuel">Make a food plan</a>' : "") +
          (OD.moduleOn("fitness") ? '<a class="btn" href="#/fitness">Set a workout routine</a>' : "") +
          (OD.moduleOn("study") ? '<a class="btn" href="#/study">Set a study target</a>' : "") +
          "</div></div>";
      } else {
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
          '<p class="hint" style="margin-top:10px">Graded from your logs — near target earns near-full credit, overshooting a more-is-better target earns a bonus. Habit chips are tap-to-check.' +
          (missing.length ? " Add more signal: " + missing.join(" · ") + "." : "") + "</p></div>" +

          '<div class="card"><div class="card-title">Consistency</div>' +
          '<div class="row" style="gap:22px;align-items:baseline">' +
          '<div><div class="score-big">' + streak + '<small> day streak</small></div>' +
          '<div class="hint">best ' + best + " in the last 6 months</div></div>" +
          "</div>" +
          '<div style="margin-top:14px">' + OD.charts.dayDots(dots) + "</div>" +
          '<p class="hint" style="margin-top:8px">Last 14 days · green = kept (' + barPct + '%+ of points, set in Settings)</p></div>' +
          "</div>";

        /* compounding + weight */
        var trendCards = '<div class="card"><div class="card-title">The compound curve — 90 days</div><div id="dash-compound"></div>' +
          '<p class="hint" style="margin-top:8px">A kept day multiplies you by 1% × its score — a perfect day is ×1.010, an overshoot day up to ×1.0125. Days under the bar don’t punish you; they just don’t multiply.</p></div>';
        if (OD.moduleOn("fitness")) {
          trendCards += '<div class="card"><div class="card-title">Body weight</div><div id="dash-weight"></div></div>';
        }
        html += '<div class="grid grid-2 section-gap">' + trendCards + "</div>";
      }

      /* ---------- quick stats tiles ---------- */

      var months = OD.lastMonths(6);
      var cur = OD.query.monthFlows(months[5]);
      var open = OD.query.openTickets();
      var active = OD.query.activeJobs();

      var tiles = "";
      if (OD.moduleOn("fuel") && db.fuelPlan) {
        var log = OD.goals.fuelLogFor(today);
        tiles += tile("Protein today", String(log ? log.protein : 0), "/ " + db.fuelPlan.protein + " g");
      }
      if (OD.moduleOn("study") && db.studyPlan.target) {
        tiles += tile("Study today", String(OD.goals.studyMinutes(today)), "/ " + db.studyPlan.target + " min");
      }
      if (OD.moduleOn("desk")) tiles += tile(simple ? "Open to-dos" : "Open tickets", String(open.length), "");
      if (OD.moduleOn("ledger") && db.txns.length) tiles += tile("Net this month", OD.fmt.moneyCompact(cur.net), "");
      if (OD.moduleOn("pipeline") && db.jobs.length) tiles += tile("Active applications", String(active.length), "");
      if (tiles) html += '<div class="tiles section-gap">' + tiles + "</div>";

      /* ---------- next actions + activity ---------- */

      var nexts = OD.moduleOn("projects") && OD.views.projects.nextActions ? OD.views.projects.nextActions() : [];
      var nextRows = nexts.slice(0, 5).map(function (n) {
        return '<div class="feed-item"><span class="feed-tag">' + OD.ui.badge(n.project, "accent") + "</span><span>" + esc(n.text) + "</span></div>";
      }).join("");
      open.slice()
        .sort(function (a, b) { var r = { high: 0, medium: 1, low: 2 }; return r[a.priority] - r[b.priority]; })
        .slice(0, Math.max(0, 5 - nexts.length))
        .forEach(function (t) {
          nextRows += '<div class="feed-item clickable" data-goto="#/desk" style="cursor:pointer"><span class="feed-tag">' +
            OD.ui.badge(t.num, t.priority === "high" ? "critical" : "plain") + "</span><span>" + esc(t.title) + "</span></div>";
        });

      var feed = activityFeed().map(function (f) {
        return '<div class="feed-item"><span class="feed-date">' + esc(OD.fmt.date(f.date)) + "</span>" +
          '<span class="feed-tag">' + OD.ui.badge(f.tag, f.tone) + "</span><span>" + esc(f.text) + "</span></div>";
      }).join("");

      html += '<div class="grid grid-2 section-gap">' +
        '<div class="card"><div class="card-title">Next actions <span class="right hint">one step each — never the whole mountain</span></div>' +
        (nextRows ? '<div class="feed">' + nextRows + "</div>" : '<div class="empty">Add a project or a to-do and its next step lands here.</div>') + "</div>" +
        '<div class="card"><div class="card-title">Recent activity</div>' +
        (feed ? '<div class="feed">' + feed + "</div>" : '<div class="empty">Everything you log lands here.</div>') +
        "</div></div>";

      /* ---------- the ops modules, still here ---------- */

      var opsCards = "";
      if (OD.moduleOn("ledger") && db.txns.length) {
        opsCards += '<div class="card"><div class="card-title">' + (simple ? "Money in vs out — last 6 months" : "Cash flow — last 6 months") + '</div><div id="dash-cashflow"></div></div>';
      }
      if (OD.moduleOn("pipeline") && db.jobs.length) {
        opsCards += '<div class="card"><div class="card-title">Job pipeline</div><div id="dash-funnel"></div>' +
          '<p class="hint" style="margin-top:10px">Counts by current stage · ' +
          esc(String(db.jobs.filter(function (j) { return j.status === "rejected"; }).length)) + " closed out, " +
          esc(String(db.jobs.filter(function (j) { return j.status === "accepted"; }).length)) + " accepted</p></div>";
      }
      if (opsCards) html += '<div class="grid grid-2 section-gap">' + opsCards + "</div>";

      el.innerHTML = html;

      /* ---------- charts ---------- */

      if (configured) {
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

      var cashEl = el.querySelector("#dash-cashflow");
      if (cashEl) {
        var flows = months.map(function (k) { return OD.query.monthFlows(k); });
        OD.charts.columns(cashEl, {
          labels: months.map(OD.fmt.monthLabel),
          series: [
            { name: simple ? "In" : "Income", color: "var(--accent)", values: flows.map(function (f) { return f.income; }) },
            { name: simple ? "Out" : "Expenses", color: "var(--series-2)", values: flows.map(function (f) { return f.expense; }) }
          ],
          format: OD.fmt.moneyCompact,
          ariaLabel: "Money in and out by month"
        });
      }

      var funnelEl = el.querySelector("#dash-funnel");
      if (funnelEl) {
        funnelEl.innerHTML = OD.charts.hbars(OD.enums.jobFunnel.map(function (s) {
          return { label: OD.fmt.title(s), value: db.jobs.filter(function (j) { return j.status === s; }).length };
        }));
      }

      /* ---------- wiring ---------- */

      var dismiss = el.querySelector('[data-act="dismiss-banner"]');
      if (dismiss) dismiss.addEventListener("click", function () {
        db.settings.bannerDismissed = true;
        OD.store.save();
        OD.app.refresh();
      });
      el.querySelectorAll("[data-goto]").forEach(function (r) {
        r.addEventListener("click", function () { location.hash = r.getAttribute("data-goto"); });
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
