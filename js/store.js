/* OpsDesk — data layer.
   One JSON document in localStorage; every view reads OD.db and calls
   OD.store.save() after a mutation. Import/export moves the same document. */
(function () {
  "use strict";

  window.OD = window.OD || {};
  OD.views = OD.views || {};
  OD.VERSION = "3.1.0";

  var KEY = "opsdesk.v1";
  var SCHEMA_VERSION = 1;

  /* ---------- enums shared across views ---------- */

  OD.enums = {
    vmStatus: ["running", "stopped", "template", "planned"],
    ticketStatus: ["open", "in-progress", "resolved"],
    ticketType: ["incident", "task"],
    ticketPriority: ["low", "medium", "high"],
    ticketArea: ["network", "virtualization", "windows", "linux", "hardware", "other"],
    moduleStatus: ["todo", "active", "done"],
    certStatus: ["planned", "studying", "scheduled", "passed"],
    planStatus: ["active", "paused", "done"],
    fwActions: ["allow", "limited", "block"]
  };

  /* ---------- small utilities ---------- */

  OD.uid = function () {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  };

  OD.todayISO = function () {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  };

  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  OD.fmt = {
    num: function (n) { return new Intl.NumberFormat("en-CA").format(n); },
    date: function (iso) {
      if (!iso) return "—";
      var p = iso.split("-");
      if (p.length < 3) return iso;
      return MONTHS[Number(p[1]) - 1] + " " + Number(p[2]);
    },
    dateFull: function (iso) {
      if (!iso) return "—";
      var p = iso.split("-");
      if (p.length < 3) return iso;
      return MONTHS[Number(p[1]) - 1] + " " + Number(p[2]) + ", " + p[0];
    },
    monthLabel: function (key) {
      var p = (key || "").split("-");
      if (p.length < 2) return key;
      return MONTHS[Number(p[1]) - 1];
    },
    title: function (s) {
      return String(s || "").replace(/(^|[-\s])\w/g, function (c) { return c.toUpperCase(); }).replace(/-/g, " ");
    }
  };

  /* ---------- modes & module visibility ---------- */

  OD.isSimple = function () { return OD.db.settings.mode === "simple"; };
  OD.moduleOn = function (name) {
    var m = OD.db.settings.modules;
    return !m || m[name] !== false;
  };

  /* Plain-language names in simple mode; the ops names in pro. */
  OD.viewLabel = function (view) {
    if (OD.isSimple()) {
      var simple = { dashboard: "Home", tasks: "Tasks", fitness: "Workouts", fuel: "Food", study: "Learning", settings: "Settings", lab: "Lab" };
      return simple[view] || view;
    }
    var pro = { dashboard: "Dashboard", tasks: "Tasks", fitness: "Training", fuel: "Fuel", study: "Study", lab: "Lab", settings: "Settings" };
    return pro[view] || view;
  };

  /* ---------- blank document ---------- */

  function defaultSettings() {
    return {
      name: "", theme: "auto", seeded: false, bannerDismissed: false,
      mode: "pro", onboarded: false,
      units: { weight: "lb" },
      greenThreshold: 0.5, // what fraction of the day's points keeps the day
      lastBackup: "",
      modules: { tasks: true, fitness: true, fuel: true, study: true, lab: true }
    };
  }

  function defaultHabits() {
    return [
      { id: OD.uid(), name: "Steps / daily walk" },
      { id: OD.uid(), name: "In bed on time" },
      { id: OD.uid(), name: "Enough water" }
    ];
  }

  function blankDb() {
    return {
      version: SCHEMA_VERSION,
      settings: defaultSettings(),
      counters: { ticket: 0 },
      zones: [],
      vms: [],
      rules: [],
      tickets: [],
      modules: [],
      certs: [],
      commands: [],
      projects: [],
      workouts: [],
      weighins: [],
      routine: { days: { 0: "", 1: "", 2: "", 3: "", 4: "", 5: "", 6: "" } },
      fuelPlan: null,
      fuelLogs: [],
      supps: [],
      studyPlan: { target: 0 },
      studyLogs: [],
      plans: [],
      habits: defaultHabits(),
      habitChecks: {}
    };
  }

  /* ---------- persistence ---------- */

  /* Fill in any keys added by newer versions, without touching real data,
     and migrate workspaces from older layouts forward. */
  function upgrade(db) {
    var fresh = blankDb();
    Object.keys(fresh).forEach(function (k) {
      if (db[k] === undefined) db[k] = fresh[k];
    });
    var s = defaultSettings();
    Object.keys(s).forEach(function (k) {
      if (db.settings[k] === undefined) db.settings[k] = s[k];
    });
    var mods = db.settings.modules;
    Object.keys(s.modules).forEach(function (k) {
      if (mods[k] === undefined) mods[k] = s.modules[k];
    });
    if (!db.settings.units || !db.settings.units.weight) db.settings.units = s.units;
    if (!db.routine || !db.routine.days) db.routine = { days: { 0: "", 1: "", 2: "", 3: "", 4: "", 5: "", 6: "" } };
    if (!db.studyPlan) db.studyPlan = { target: 0 };

    /* v3: Projects + Desk merged into Tasks */
    if (mods.projects !== undefined || mods.desk !== undefined) {
      mods.tasks = mods.projects !== false || mods.desk !== false;
      delete mods.projects;
      delete mods.desk;
    }

    /* v3: Ledger and Pipeline removed from the app. Any real entries are
       parked in db.archive (invisible, travels with backups) instead of
       being silently destroyed — delete the archive key to purge for good. */
    var hadMoney = (db.txns && db.txns.length) || (db.jobs && db.jobs.length);
    if (hadMoney) {
      db.archive = db.archive || {};
      if (db.jobs && db.jobs.length) db.archive.jobs = db.jobs;
      if (db.txns && db.txns.length) db.archive.txns = db.txns;
      if (db.accounts && db.accounts.length) db.archive.accounts = db.accounts;
      db.archive.archivedAt = db.archive.archivedAt || OD.todayISO();
    }
    delete db.jobs; delete db.txns; delete db.accounts;
    delete mods.ledger; delete mods.pipeline;

    /* v3: study plans — existing curriculum rows join a first plan */
    if (db.modules.length && !db.plans.length && !db.modules.some(function (m) { return m.planId; })) {
      var pid = OD.uid();
      db.plans.push({ id: pid, name: "My study plan", status: "active", examDate: "" });
      db.modules.forEach(function (m) { m.planId = pid; });
      db.studyLogs.forEach(function (l) { if (!l.planId) l.planId = pid; });
    }
    return db;
  }

  OD.store = {
    init: function () {
      var raw = null;
      try { raw = localStorage.getItem(KEY); } catch (e) { /* storage blocked */ }
      if (raw) {
        try {
          OD.db = upgrade(JSON.parse(raw));
        } catch (e) {
          OD.db = blankDb();
        }
        // anyone with existing data predates the welcome screen — don't show it
        if (raw && OD.db.settings.onboarded === false && (OD.db.tickets.length || OD.db.vms.length || OD.db.workouts.length || OD.db.fuelLogs.length)) {
          OD.db.settings.onboarded = true;
        }
      } else {
        // fresh install: an empty workspace behind the welcome screen,
        // which seeds it according to what the person picks
        OD.db = blankDb();
      }
    },

    save: function () {
      try {
        localStorage.setItem(KEY, JSON.stringify(OD.db));
      } catch (e) {
        if (OD.ui && OD.ui.toast) OD.ui.toast("Could not save — browser storage is unavailable.", true);
      }
      if (OD.cloud && OD.cloud.onLocalChange) OD.cloud.onLocalChange();
    },

    exportJson: function () {
      var stamp = OD.todayISO();
      OD.db.settings.lastBackup = stamp;
      OD.store.save();
      var blob = new Blob([JSON.stringify(OD.db, null, 2)], { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "opsdesk-backup-" + stamp + ".json";
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    },

    importJson: function (text) {
      var data;
      try { data = JSON.parse(text); } catch (e) { throw new Error("That file isn't valid JSON."); }
      if (!data || typeof data !== "object" || !Array.isArray(data.tickets) || !Array.isArray(data.vms)) {
        throw new Error("That file doesn't look like an OpsDesk backup.");
      }
      if (!data.settings || typeof data.settings !== "object") data.settings = defaultSettings();
      upgrade(data);
      data.version = SCHEMA_VERSION;
      data.settings.onboarded = true;
      OD.db = data;
      OD.store.save();
    },

    resetToSeed: function () {
      var keep = OD.db.settings;
      OD.db = OD.seed();
      OD.db.settings.name = keep.name;
      OD.db.settings.theme = keep.theme;
      OD.store.save();
    },

    resetToSimple: function (name) {
      var theme = OD.db.settings.theme;
      OD.db = OD.seedSimple();
      OD.db.settings.theme = theme;
      if (name) OD.db.settings.name = name;
      OD.store.save();
    },

    startBlank: function () {
      var keep = OD.db.settings;
      OD.db = blankDb();
      OD.db.settings.name = keep.name;
      OD.db.settings.theme = keep.theme;
      OD.db.settings.mode = keep.mode;
      OD.db.settings.modules = keep.modules;
      OD.db.settings.onboarded = true;
      OD.db.settings.bannerDismissed = true;
      OD.store.save();
    }
  };

  /* ---------- cross-view queries ---------- */

  OD.query = {
    nextTicketNumber: function () {
      OD.db.counters.ticket += 1;
      return "T-" + String(OD.db.counters.ticket).padStart(4, "0");
    },

    openTickets: function () {
      return OD.db.tickets.filter(function (t) { return t.status !== "resolved"; });
    },

    planById: function (id) {
      return OD.db.plans.find(function (p) { return p.id === id; }) || null;
    },

    planName: function (id) {
      var p = OD.query.planById(id);
      return p ? p.name : "General";
    },

    /* minutes logged against one plan over the last n days (0 = all time) */
    planMinutes: function (planId, days) {
      var cutoff = days ? OD.goals.dayISO(-(days - 1)) : "";
      return OD.db.studyLogs.reduce(function (sum, l) {
        if (l.planId !== planId) return sum;
        if (cutoff && l.date < cutoff) return sum;
        return sum + (Number(l.minutes) || 0);
      }, 0);
    }
  };

  /* ---------- goals engine (v2): units, logs, and the daily 1% score ---------- */

  OD.units = {
    kgToLb: function (kg) { return kg * 2.20462; },
    lbToKg: function (lb) { return lb / 2.20462; },
    /* display weight in the user's unit, one decimal */
    weight: function (kg) {
      if ((OD.db.settings.units || {}).weight === "kg") return (Math.round(kg * 10) / 10) + " kg";
      return (Math.round(OD.units.kgToLb(kg) * 10) / 10) + " lb";
    }
  };

  OD.goals = {
    dayISO: function (offset) {
      var d = new Date();
      d.setDate(d.getDate() + (offset || 0));
      return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    },
    weekdayOf: function (iso) { return new Date(iso + "T12:00:00").getDay(); },

    fuelLogFor: function (iso) {
      return OD.db.fuelLogs.find(function (l) { return l.date === iso; }) || null;
    },
    kcalOf: function (log) {
      return Math.round((Number(log.protein) || 0) * 4 + (Number(log.carbs) || 0) * 4 + (Number(log.fat) || 0) * 9);
    },
    suppsAllTaken: function (log) {
      if (!OD.db.supps.length) return false;
      if (!log || !log.supps) return false;
      return OD.db.supps.every(function (s) { return log.supps[s.id]; });
    },
    workoutsOn: function (iso) {
      return OD.db.workouts.filter(function (w) { return w.date === iso; });
    },
    studyMinutes: function (iso) {
      return OD.db.studyLogs.reduce(function (sum, l) { return sum + (l.date === iso ? Number(l.minutes) || 0 : 0); }, 0);
    },
    routineActive: function () {
      var days = OD.db.routine.days || {};
      return Object.keys(days).some(function (k) { return (days[k] || "").trim(); });
    },
    plannedLabel: function (iso) {
      return ((OD.db.routine.days || {})[OD.goals.weekdayOf(iso)] || "").trim();
    },

    /* ---------- habits (checked by hand, scored like everything else) ---------- */

    habitChecked: function (iso, habitId) {
      var day = OD.db.habitChecks[iso];
      return !!(day && day[habitId]);
    },
    toggleHabit: function (iso, habitId) {
      var checks = OD.db.habitChecks;
      if (!checks[iso]) checks[iso] = {};
      if (checks[iso][habitId]) delete checks[iso][habitId];
      else checks[iso][habitId] = true;
    },

    greenBar: function () {
      var g = OD.db.settings.greenThreshold;
      return typeof g === "number" ? g : 0.5;
    },

    /* The auto day score — GRADED, not pass/fail. Each configured component
       contributes 0–1 (study can overshoot to 1.25), so being near target
       earns near-full credit and blowing past a more-is-better target earns
       a bonus. Components only count when configured, so an untouched area
       never drags the score down.

         macros — average of a calorie score and a protein score.
                  Calories: full credit inside a goal-aware band (cutting
                  tolerates under-eating, bulking tolerates over), fading
                  linearly to 0 by 35% outside it. Protein: logged/90%-of-
                  target, capped at 1 (extra protein is fine, not extra credit).
         supps  — the fraction of your list you ticked (2 of 3 = 0.67).
         train  — planned day: 1 if you logged a workout; rest day: 1.
         study  — minutes/target, with overshoot credited up to 1.25.
         habits — 1 point each, checked off by hand on the dashboard. */
    /* Graded macro score for one day's log against the plan — shared by the
       day score and the Fuel history badges. */
    macroScore: function (log) {
      function clamp01(n) { return Math.max(0, Math.min(1, n)); }
      if (!log || !OD.db.fuelPlan) return { score: 0, detail: "not logged" };
      var t = OD.db.fuelPlan;
      var kcal = OD.goals.kcalOf(log);
      var dev = (kcal - t.kcal) / t.kcal;
      var goal = (t.stats && t.stats.goal) || "maintain";
      var lo = goal === "cut" ? -0.2 : -0.1;   // cutting: under-eating tolerated
      var hi = goal === "gain" ? 0.2 : 0.1;    // bulking: over-eating tolerated
      var calScore = 1;
      if (dev < lo) calScore = clamp01(1 - (lo - dev) / 0.35);
      else if (dev > hi) calScore = clamp01(1 - (dev - hi) / 0.35);
      var proteinScore = clamp01((Number(log.protein) || 0) / (t.protein * 0.9));
      return {
        score: (calScore + proteinScore) / 2,
        calScore: calScore,
        proteinScore: proteinScore,
        kcal: kcal,
        detail: kcal + " kcal · " + (Number(log.protein) || 0) + " g"
      };
    },

    dayScore: function (iso) {
      var possible = 0, earned = 0, parts = [];

      if (OD.moduleOn("fuel") && OD.db.fuelPlan) {
        possible++;
        var log = OD.goals.fuelLogFor(iso);
        var m = OD.goals.macroScore(log);
        earned += m.score;
        parts.push({ key: "fuel", label: "Macros", score: m.score, ok: m.score >= 0.99, detail: m.detail });
      }

      if (OD.moduleOn("fuel") && OD.db.supps.length) {
        possible++;
        var logS = OD.goals.fuelLogFor(iso);
        var taken = OD.db.supps.filter(function (x) { return logS && logS.supps && logS.supps[x.id]; }).length;
        var frac = taken / OD.db.supps.length;
        earned += frac;
        parts.push({ key: "supps", label: "Supplements", score: frac, ok: frac >= 0.99, detail: taken + " of " + OD.db.supps.length });
      }

      if (OD.moduleOn("fitness")) {
        if (OD.goals.routineActive()) {
          possible++;
          var planned = OD.goals.plannedLabel(iso);
          var isRest = !planned || /^rest$/i.test(planned);
          var worked = OD.goals.workoutsOn(iso).length > 0;
          var sT = isRest ? 1 : (worked ? 1 : 0);
          earned += sT;
          parts.push({ key: "train", label: isRest ? "Rest day" : planned, score: sT, ok: sT >= 0.99, detail: isRest ? "recovery counts" : (worked ? "trained" : "not yet") });
        } else if (OD.goals.workoutsOn(iso).length) {
          possible++; earned++;
          parts.push({ key: "train", label: "Trained", score: 1, ok: true });
        }
      }

      if (OD.moduleOn("study") && (OD.db.studyPlan.target || 0) > 0) {
        possible++;
        var mins = OD.goals.studyMinutes(iso);
        var sS = Math.min(mins / OD.db.studyPlan.target, 1.25); // overshoot pays, capped
        earned += sS;
        parts.push({ key: "study", label: "Study " + OD.db.studyPlan.target + " min", score: sS, ok: sS >= 0.99, detail: mins + " min" });
      }

      OD.db.habits.forEach(function (h) {
        possible++;
        var done = OD.goals.habitChecked(iso, h.id);
        if (done) earned++;
        parts.push({ key: "habit", habitId: h.id, label: h.name, score: done ? 1 : 0, ok: done, detail: done ? "" : "tap to check off" });
      });

      return { possible: possible, earned: earned, ratio: possible ? earned / possible : 0, parts: parts };
    },

    /* green ≥ your bar (Settings) · warn = partial · off = nothing tracked */
    dayTone: function (iso) {
      var s = OD.goals.dayScore(iso);
      if (!s.possible) return "off";
      if (s.ratio >= OD.goals.greenBar()) return "good";
      if (s.earned > 0.1) return "warn";
      return "off";
    },

    /* consecutive green days ending yesterday (today is still in progress) */
    streak: function () {
      var n = 0;
      for (var i = 1; i <= 365; i++) {
        if (OD.goals.dayTone(OD.goals.dayISO(-i)) === "good") n++;
        else break;
      }
      return n;
    },

    /* The compounding curve, graded: a kept day multiplies you by
       1 + 1% × its score — so a 100% day is ×1.010, an overshoot day up to
       ×1.0125, a bare "showed up" day still grows you a little. Days under
       the bar don't punish you; they just don't multiply. */
    compound: function (days) {
      var out = [], value = 1;
      var bar = OD.goals.greenBar();
      for (var i = days - 1; i >= 1; i--) {
        var s = OD.goals.dayScore(OD.goals.dayISO(-i));
        if (s.possible && s.ratio >= bar) value *= 1 + 0.01 * Math.min(s.ratio, 1.25);
        out.push({ date: OD.goals.dayISO(-i), value: value });
      }
      out.push({ date: OD.goals.dayISO(0), value: value });
      return out;
    }
  };
})();
