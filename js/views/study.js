/* OpsDesk — Study: curriculum modules, cert tracker, and the command vault
   ("commands I know cold") with a drill mode to keep them cold. */
(function () {
  "use strict";

  var esc = function (s) { return OD.ui.esc(s); };

  var search = "";
  var filterPlan = "all";

  var MOD_TONE = { todo: "plain", active: "accent", done: "good" };
  var CERT_TONE = { planned: "plain", studying: "accent", scheduled: "warning", passed: "good" };
  var PLAN_TONE = { active: "accent", paused: "plain", done: "good" };

  function planOptions(includeNone) {
    var opts = OD.db.plans.map(function (p) { return { value: p.id, label: p.name }; });
    if (includeNone) opts.push({ value: "", label: "General (no plan)" });
    return opts;
  }

  function activePlanId() {
    var p = OD.db.plans.find(function (x) { return x.status === "active"; });
    return p ? p.id : "";
  }

  function planForm(p) {
    OD.ui.form({
      title: p ? "Edit plan" : "New study plan",
      values: p,
      fields: [
        { key: "name", label: "Plan", required: true, span2: true, placeholder: "CompTIA Network+, CCNA, French…" },
        { key: "status", label: "Status", type: "select", options: OD.enums.planStatus },
        { key: "examDate", label: "Exam / target date", type: "date" }
      ],
      onSubmit: function (v) {
        if (p) Object.assign(p, v);
        else { v.id = OD.uid(); OD.db.plans.push(v); }
        OD.store.save();
        OD.app.refresh();
        OD.ui.toast(p ? "Plan updated." : "Plan added — give it topics below.");
      },
      onDelete: p && function () {
        OD.ui.confirm({ title: "Delete plan?", message: p.name + " — its topics and logged sessions stay, filed under General." }, function () {
          OD.db.modules.forEach(function (m) { if (m.planId === p.id) m.planId = ""; });
          OD.db.studyLogs.forEach(function (l) { if (l.planId === p.id) l.planId = ""; });
          OD.db.plans = OD.db.plans.filter(function (x) { return x.id !== p.id; });
          if (filterPlan === p.id) filterPlan = "all";
          OD.store.save();
          OD.app.refresh();
        });
      }
    });
  }

  function daysUntil(iso) {
    if (!iso) return null;
    var ms = new Date(iso + "T12:00:00") - new Date(OD.todayISO() + "T12:00:00");
    return Math.round(ms / 86400000);
  }

  function moduleForm(m) {
    var simple = OD.isSimple();
    OD.ui.form({
      title: m ? (simple ? "Edit topic" : "Edit module") : (simple ? "New topic" : "New module"),
      values: m,
      fields: [
        { key: "name", label: simple ? "What are you learning?" : "Module name", required: true, span2: true, placeholder: simple ? "Excel basics, driving lessons, French…" : "Module 2 — TLS & internal CA" },
        { key: "planId", label: "Plan", type: "select", options: planOptions(true), default: filterPlan !== "all" ? filterPlan : activePlanId() },
        { key: "status", label: "Status", type: "select", options: OD.enums.moduleStatus },
        { key: "hours", label: "Hours logged", type: "number", step: "0.5" },
        { key: "topics", label: simple ? "Details" : "Topics", span2: true, placeholder: simple ? "What it covers (optional)" : "What this module covers" },
        { key: "proof", label: simple ? "How will you know it's done?" : "Proof of work", span2: true, placeholder: simple ? "e.g. I can build a monthly budget sheet myself" : "The demonstrable thing that says it's done" },
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

  /* Interview drill — resolved tickets become behavioural-question practice.
     The KB's cause → fix → lesson structure maps straight onto the answer
     an interviewer wants to hear. */
  function interviewDrill() {
    var deck = OD.db.tickets.filter(function (t) { return t.status === "resolved" && t.lesson; });
    if (!deck.length) {
      OD.ui.toast("Resolve a ticket and write its lesson first — those become your interview answers.", true);
      return;
    }
    for (var i = deck.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = deck[i]; deck[i] = deck[j]; deck[j] = tmp;
    }
    var idx = 0, revealed = false;

    var m = OD.ui.openModal(OD.ui.modalHead("Interview drill") + '<div id="idrill-body"></div>');
    var body = m.querySelector("#idrill-body");

    function part(label, text) {
      if (!text) return "";
      return '<div class="kb-part"><b>' + esc(label) + '</b><div class="prose-block">' + esc(text) + "</div></div>";
    }

    function draw() {
      var t = deck[idx];
      body.innerHTML =
        '<p class="subtle">“Tell me about a technical problem you worked through.”</p>' +
        '<div class="flash" style="margin-top:10px"><div class="flash-q">Your story: <b>' + esc(t.title) + "</b></div></div>" +
        (revealed
          ? part("Situation", t.symptom) + part("Diagnosis", t.cause) + part("What I did", t.fix) + part("Takeaway", t.lesson)
          : '<p class="hint" style="margin-top:10px">Say your answer out loud — situation, diagnosis, what you did, takeaway — then check it against your own write-up.</p>') +
        '<p class="hint" style="text-align:center;margin-top:10px">' + (idx + 1) + " of " + deck.length + "</p>" +
        '<div class="modal-actions" style="justify-content:center">' +
        (revealed
          ? '<button class="btn primary" data-act="next" type="button">' + (idx + 1 < deck.length ? "Next story →" : "Finish") + "</button>"
          : '<button class="btn primary" data-act="reveal" type="button">Check my answer</button>') +
        "</div>";

      var btn = body.querySelector("[data-act]");
      btn.focus();
      btn.addEventListener("click", function () {
        if (!revealed) { revealed = true; draw(); return; }
        if (idx + 1 < deck.length) { idx++; revealed = false; draw(); }
        else { OD.ui.closeModal(); OD.ui.toast("Drill done — " + deck.length + " war stories, interview-ready."); }
      });
    }
    draw();
  }

  /* Daily study target + quick minutes log — the "guide" part:
     a small number hit most days beats a heroic number hit twice. */
  function targetForm() {
    OD.ui.form({
      title: "Daily study target",
      values: { target: OD.db.studyPlan.target || "" },
      fields: [
        { key: "target", label: "Minutes per day", type: "number", required: true,
          hint: "Pick something you can hit on a bad day — 20–30 min compounds; 0 turns the target off." }
      ],
      onSubmit: function (v) {
        OD.db.studyPlan.target = Number(v.target) || 0;
        OD.store.save();
        OD.app.refresh();
        OD.ui.toast(OD.db.studyPlan.target ? "Target set — " + OD.db.studyPlan.target + " min a day." : "Target off.");
      }
    });
  }

  function studyLogForm(entry) {
    OD.ui.form({
      title: entry ? "Edit study session" : "Log study time",
      values: entry,
      fields: [
        { key: "date", label: "Date", type: "date", required: true, default: OD.todayISO() },
        { key: "minutes", label: "Minutes", type: "number", required: true },
        { key: "planId", label: "Plan", type: "select", options: planOptions(true), default: activePlanId() },
        { key: "what", label: "What did you work on?", span2: true, placeholder: "Subnetting practice, chapter 4…" }
      ],
      onSubmit: function (v) {
        if (entry) Object.assign(entry, v);
        else { v.id = OD.uid(); OD.db.studyLogs.push(v); }
        OD.store.save();
        OD.app.refresh();
        var t = OD.db.studyPlan.target;
        var mins = OD.goals.studyMinutes(v.date);
        OD.ui.toast(t && mins >= t ? "Target hit — " + mins + " min today." : "Logged " + v.minutes + " min.");
      },
      onDelete: entry && function () {
        OD.db.studyLogs = OD.db.studyLogs.filter(function (x) { return x.id !== entry.id; });
        OD.store.save();
        OD.app.refresh();
      }
    });
  }

  OD.views.study = {
    title: "Study",
    actions: function () {
      var simple = OD.isSimple();
      var a = [];
      if (!simple) a.push({ label: "Command drill", onClick: drill });
      a.push({ label: "Interview drill", onClick: interviewDrill });
      a.push({ label: "+ Plan", onClick: function () { planForm(null); } });
      a.push({ label: "+ Log study", primary: true, onClick: function () { studyLogForm(null); } });
      return a;
    },

    render: function (el) {
      var db = OD.db;
      var simple = OD.isSimple();
      var done = db.modules.filter(function (m) { return m.status === "done"; }).length;
      var hours = db.modules.reduce(function (s, m) { return s + (Number(m.hours) || 0); }, 0);
      var passed = db.certs.filter(function (c) { return c.status === "passed"; }).length;
      var pct = db.modules.length ? (done / db.modules.length) * 100 : 0;

      var todayMins = OD.goals.studyMinutes(OD.todayISO());
      var target = db.studyPlan.target || 0;
      var weekMins = 0;
      for (var wi = 0; wi < 7; wi++) weekMins += OD.goals.studyMinutes(OD.goals.dayISO(-wi));

      var html = '<div class="tiles">' +
        '<div class="tile"><div class="tile-label">Today</div><div class="tile-value">' + todayMins +
        (target ? " <small>of " + target + " min</small>" : " <small>min</small>") + "</div>" +
        (target ? '<div style="margin-top:8px">' + OD.charts.meter(target ? (todayMins / target) * 100 : 0) + "</div>"
          : '<div class="tile-delta">no daily target set</div>') + "</div>" +
        '<div class="tile"><div class="tile-label">Last 7 days</div><div class="tile-value">' + weekMins + " <small>min</small></div></div>" +
        '<div class="tile"><div class="tile-label">' + (simple ? "Topics finished" : "Curriculum") + '</div><div class="tile-value">' + done + " <small>of " + db.modules.length + "</small></div>" +
        '<div style="margin-top:8px">' + OD.charts.meter(pct) + "</div></div>" +
        '<div class="tile"><div class="tile-label">' + (simple ? "Courses & certificates" : "Certifications") + '</div><div class="tile-value">' + passed + " <small>of " + db.certs.length + " done</small></div></div>" +
        (simple ? "" : '<div class="tile"><div class="tile-label">Commands in the vault</div><div class="tile-value">' + db.commands.length + "</div></div>") +
        "</div>";

      /* plans — each track with its own progress, minutes, and countdown */
      var planCards = db.plans.map(function (p) {
        var mods = db.modules.filter(function (m) { return m.planId === p.id; });
        var doneMods = mods.filter(function (m) { return m.status === "done"; }).length;
        var mins7 = OD.query.planMinutes(p.id, 7);
        var dleft = daysUntil(p.examDate);
        return '<div class="card plan-card clickable" data-plan="' + p.id + '" style="cursor:pointer">' +
          '<div class="spread"><span class="kb-title">' + esc(p.name) + "</span>" +
          '<span class="row">' + OD.ui.badge(p.status, PLAN_TONE[p.status]) +
          (dleft !== null && p.status !== "done" ? '<span class="hint">' + (dleft >= 0 ? dleft + " days left" : Math.abs(dleft) + " days past") + "</span>" : "") +
          "</span></div>" +
          '<div class="row" style="margin-top:10px;gap:12px"><div style="flex:1">' + OD.charts.meter(mods.length ? (doneMods / mods.length) * 100 : 0) + "</div>" +
          '<span class="hint">' + doneMods + "/" + mods.length + " topics</span></div>" +
          '<div class="hint" style="margin-top:6px">' + mins7 + " min this week</div>" +
          "</div>";
      }).join("");
      if (db.plans.length) {
        html += '<div class="grid grid-2 section-gap">' + planCards + "</div>";
      } else {
        html += '<div class="card section-gap"><div class="empty">Add a plan (+ Plan) for each thing you\'re working toward — Network+, CCNA, anything. Topics and study time get filed under it.</div></div>';
      }

      /* study log */
      var logRows = db.studyLogs
        .slice()
        .sort(function (a, b) { return a.date < b.date ? 1 : -1; })
        .slice(0, 10)
        .map(function (l) {
          return '<tr class="clickable" data-studylog="' + l.id + '"><td>' + esc(OD.fmt.date(l.date)) + "</td>" +
            '<td class="num">' + esc(l.minutes) + "</td>" +
            "<td>" + OD.ui.badge(OD.query.planName(l.planId), "plain") + "</td>" +
            "<td>" + esc(l.what || "—") + "</td></tr>";
        }).join("");
      html += '<div class="card section-gap"><div class="card-title">Study log ' +
        '<button class="btn sm ghost right" id="study-target" type="button">' +
        (target ? "Daily target: " + target + " min" : "Set a daily target") + "</button></div>" +
        OD.ui.table(["Date", { label: "Minutes", cls: "num" }, "Plan", "What"], logRows,
          "Log sessions with + Log study — minutes count toward your day score once a target is set.") + "</div>";

      /* curriculum — filterable by plan */
      var mods = db.modules.filter(function (m) {
        if (filterPlan === "all") return true;
        if (filterPlan === "") return !m.planId;
        return m.planId === filterPlan;
      });
      var modRows = mods.map(function (m) {
        return '<tr class="clickable" data-module="' + m.id + '">' +
          "<td><b>" + esc(m.name) + "</b></td>" +
          "<td>" + OD.ui.badge(OD.query.planName(m.planId), "plain") + "</td>" +
          "<td>" + OD.ui.badge(m.status, MOD_TONE[m.status]) + "</td>" +
          '<td class="num">' + esc(m.hours || 0) + "</td>" +
          '<td class="fade">' + esc(m.topics) + "</td>" +
          '<td class="fade">' + esc(m.proof) + "</td></tr>";
      }).join("");

      html += '<div class="card section-gap"><div class="card-title">' + (simple ? "What I'm learning" : "Topics") +
        '<span class="right row"><select class="control" id="study-plan-filter" style="width:auto">' +
        '<option value="all"' + (filterPlan === "all" ? " selected" : "") + ">All plans</option>" +
        db.plans.map(function (p) {
          return '<option value="' + p.id + '"' + (filterPlan === p.id ? " selected" : "") + ">" + esc(p.name) + "</option>";
        }).join("") +
        '<option value=""' + (filterPlan === "" ? " selected" : "") + '>General</option></select>' +
        '<button class="btn sm ghost" id="study-add-topic" type="button">' + (simple ? "+ Topic" : "+ Module") + "</button></span></div>" +
        OD.ui.table([simple ? "Topic" : "Module", "Plan", "Status", { label: "Hours", cls: "num" }, simple ? "Details" : "Topics", simple ? "How I'll know it's done" : "Proof of work"], modRows,
          db.modules.length ? "Nothing under this plan yet." : (simple ? "Add something you're learning — a course, a skill, a book." : "Add your first module — small, finishable, with a proof of work.")) + "</div>";

      /* certs (+ command vault in pro mode) */
      var certRows = db.certs.map(function (c) {
        return '<tr class="clickable" data-cert="' + c.id + '"><td><b>' + esc(c.name) + "</b></td>" +
          "<td>" + OD.ui.badge(c.status, CERT_TONE[c.status]) + "</td>" +
          '<td class="fade">' + esc(c.date ? OD.fmt.dateFull(c.date) : "—") + "</td></tr>";
      }).join("");

      var certCard = '<div class="card"><div class="card-title">' + (simple ? "Courses & certificates" : "Certifications") + " " +
        '<button class="btn sm ghost right" id="add-cert" type="button">+ Add</button></div>' +
        OD.ui.table([simple ? "Name" : "Certification", "Status", "Date"], certRows, simple ? "Courses, certificates, and goals with a date." : "Track exam targets here.") + "</div>";

      if (simple) {
        html += '<div class="section-gap">' + certCard + "</div>";
      } else {
        var cmds = db.commands.filter(function (c) {
          if (!search) return true;
          var q = search.toLowerCase();
          return (c.cmd + " " + c.what).toLowerCase().indexOf(q) !== -1;
        });
        var cmdRows = cmds.map(function (c) {
          return '<tr class="clickable" data-cmd="' + c.id + '"><td class="mono">' + esc(c.cmd) + "</td><td>" + esc(c.what) + "</td></tr>";
        }).join("");

        html += '<div class="grid grid-2 section-gap">' + certCard +
          '<div class="card"><div class="card-title">Command vault ' +
          '<button class="btn sm ghost right" id="add-cmd" type="button">+ Add</button></div>' +
          '<div class="filters"><input class="control search-input" id="cmd-search" type="search" placeholder="Search the vault…" value="' + esc(search) + '"></div>' +
          OD.ui.table(["Command", "What it does"], cmdRows,
            db.commands.length ? "Nothing matches." : "Commands you want to know cold live here — then Drill them.") +
          "</div></div>";
      }

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
      el.querySelector("#study-target").addEventListener("click", targetForm);
      el.querySelectorAll("[data-plan]").forEach(function (c) {
        c.addEventListener("click", function () {
          planForm(db.plans.find(function (p) { return p.id === c.getAttribute("data-plan"); }));
        });
      });
      var planFilter = el.querySelector("#study-plan-filter");
      if (planFilter) planFilter.addEventListener("change", function (e) {
        filterPlan = e.target.value;
        OD.app.refresh();
      });
      var addTopic = el.querySelector("#study-add-topic");
      if (addTopic) addTopic.addEventListener("click", function () { moduleForm(null); });
      el.querySelectorAll("[data-studylog]").forEach(function (r) {
        r.addEventListener("click", function () {
          studyLogForm(db.studyLogs.find(function (l) { return l.id === r.getAttribute("data-studylog"); }));
        });
      });
      el.querySelector("#add-cert").addEventListener("click", function () { certForm(null); });
      var addCmd = el.querySelector("#add-cmd");
      if (addCmd) addCmd.addEventListener("click", function () { commandForm(null); });
      var searchEl = el.querySelector("#cmd-search");
      if (searchEl) searchEl.addEventListener("input", function () {
        search = searchEl.value;
        var pos = searchEl.selectionStart;
        OD.app.refresh();
        var again = document.getElementById("cmd-search");
        if (again) { again.focus(); again.setSelectionRange(pos, pos); }
      });
    }
  };

  /* command-palette hooks */
  OD.views.study.newModule = function () { moduleForm(null); };
  OD.views.study.logStudy = function () { studyLogForm(null); };
  OD.views.study.newPlan = function () { planForm(null); };
  OD.views.study.openPlan = function (id) {
    var p = OD.db.plans.find(function (x) { return x.id === id; });
    if (p) planForm(p);
  };
  OD.views.study.openModule = function (id) {
    var m = OD.db.modules.find(function (x) { return x.id === id; });
    if (m) moduleForm(m);
  };
  OD.views.study.openCert = function (id) {
    var c = OD.db.certs.find(function (x) { return x.id === id; });
    if (c) certForm(c);
  };
  OD.views.study.openCommand = function (id) {
    var c = OD.db.commands.find(function (x) { return x.id === id; });
    if (c) commandForm(c);
  };
})();
