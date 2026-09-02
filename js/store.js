/* OpsDesk — data layer.
   One JSON document in localStorage; every view reads OD.db and calls
   OD.store.save() after a mutation. Import/export moves the same document. */
(function () {
  "use strict";

  window.OD = window.OD || {};
  OD.views = OD.views || {};
  OD.VERSION = "2.0.0";

  var KEY = "opsdesk.v1";
  var SCHEMA_VERSION = 1;

  /* ---------- enums shared across views ---------- */

  OD.enums = {
    vmStatus: ["running", "stopped", "template", "planned"],
    ticketStatus: ["open", "in-progress", "resolved"],
    ticketType: ["incident", "task"],
    ticketPriority: ["low", "medium", "high"],
    ticketArea: ["network", "virtualization", "windows", "linux", "hardware", "other"],
    accountTypes: ["asset", "liability", "equity", "income", "expense"],
    jobStatus: ["saved", "applied", "screening", "interview", "offer", "accepted", "rejected"],
    jobFunnel: ["saved", "applied", "screening", "interview", "offer"],
    moduleStatus: ["todo", "active", "done"],
    certStatus: ["planned", "studying", "scheduled", "passed"],
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

  OD.monthKey = function (iso) { return (iso || "").slice(0, 7); };

  /* Last n month keys ending at the current month, oldest first. */
  OD.lastMonths = function (n) {
    var out = [];
    var d = new Date();
    d.setDate(1);
    for (var i = 0; i < n; i++) {
      out.unshift(d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"));
      d.setMonth(d.getMonth() - 1);
    }
    return out;
  };

  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  OD.fmt = {
    money: function (n) {
      try {
        return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(n);
      } catch (e) {
        return "$" + Number(n).toFixed(2);
      }
    },
    moneyCompact: function (n) {
      var abs = Math.abs(n);
      var sign = n < 0 ? "-" : "";
      if (abs >= 1000000) return sign + "$" + (abs / 1000000).toFixed(1) + "M";
      if (abs >= 10000) return sign + "$" + Math.round(abs / 1000) + "K";
      if (abs >= 1000) return sign + "$" + (abs / 1000).toFixed(1) + "K";
      return sign + "$" + Math.round(abs);
    },
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

  /* Plain-language names in simple mode; the IT-department names in pro. */
  OD.viewLabel = function (view) {
    if (OD.isSimple()) {
      var simple = { dashboard: "Home", projects: "Projects", fitness: "Workouts", fuel: "Food", desk: "To-dos", ledger: "Money", pipeline: "Job hunt", study: "Learning", settings: "Settings", lab: "Lab" };
      return simple[view] || view;
    }
    var pro = { dashboard: "Dashboard", projects: "Projects", fitness: "Training", fuel: "Fuel", lab: "Lab", desk: "Desk", ledger: "Ledger", pipeline: "Pipeline", study: "Study", settings: "Settings" };
    return pro[view] || view;
  };

  /* ---------- blank document ---------- */

  function defaultSettings() {
    return {
      name: "", theme: "auto", seeded: false, bannerDismissed: false,
      mode: "pro", onboarded: false,
      units: { weight: "lb" },
      modules: { projects: true, fitness: true, fuel: true, study: true, desk: true, ledger: true, pipeline: true, lab: true }
    };
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
      accounts: [],
      txns: [],
      jobs: [],
      modules: [],
      certs: [],
      commands: [],
      /* goals engine (v2) */
      projects: [],
      workouts: [],
      weighins: [],
      routine: { days: { 0: "", 1: "", 2: "", 3: "", 4: "", 5: "", 6: "" } },
      fuelPlan: null,
      fuelLogs: [],
      supps: [],
      studyPlan: { target: 0 },
      studyLogs: []
    };
  }

  /* ---------- persistence ---------- */

  /* Fill in any keys added by newer versions, without touching real data. */
  function upgrade(db) {
    var fresh = blankDb();
    Object.keys(fresh).forEach(function (k) {
      if (db[k] === undefined) db[k] = fresh[k];
    });
    var s = defaultSettings();
    Object.keys(s).forEach(function (k) {
      if (db.settings[k] === undefined) db.settings[k] = s[k];
    });
    // nested defaults: new module keys and units for workspaces from older versions
    Object.keys(s.modules).forEach(function (k) {
      if (db.settings.modules[k] === undefined) db.settings.modules[k] = s.modules[k];
    });
    if (!db.settings.units || !db.settings.units.weight) db.settings.units = s.units;
    if (!db.routine || !db.routine.days) db.routine = { days: { 0: "", 1: "", 2: "", 3: "", 4: "", 5: "", 6: "" } };
    if (!db.studyPlan) db.studyPlan = { target: 0 };
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
        if (raw && OD.db.settings.onboarded === false && (OD.db.tickets.length || OD.db.txns.length || OD.db.vms.length)) {
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
    },

    exportJson: function () {
      var stamp = OD.todayISO();
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

    accountById: function (id) {
      return OD.db.accounts.find(function (a) { return a.id === id; }) || null;
    },

    accountName: function (id) {
      var a = OD.query.accountById(id);
      return a ? a.name : "?";
    },

    /* Signed balance per account: debits minus credits, then flipped for
       credit-normal account types so every balance reads as a positive
       "what this account holds / owes / earned / cost". */
    accountBalance: function (id) {
      var raw = 0;
      OD.db.txns.forEach(function (t) {
        if (t.debit === id) raw += t.amount;
        if (t.credit === id) raw -= t.amount;
      });
      var a = OD.query.accountById(id);
      if (a && (a.type === "liability" || a.type === "equity" || a.type === "income")) return -raw;
      return raw;
    },

    /* Income and expense totals for one YYYY-MM key. */
    monthFlows: function (key) {
      var income = 0, expense = 0;
      OD.db.txns.forEach(function (t) {
        if (OD.monthKey(t.date) !== key) return;
        var d = OD.query.accountById(t.debit);
        var c = OD.query.accountById(t.credit);
        if (c && c.type === "income") income += t.amount;
        if (d && d.type === "expense") expense += t.amount;
      });
      return { income: income, expense: expense, net: income - expense };
    },

    openTickets: function () {
      return OD.db.tickets.filter(function (t) { return t.status !== "resolved"; });
    },

    activeJobs: function () {
      return OD.db.jobs.filter(function (j) { return j.status !== "rejected" && j.status !== "accepted"; });
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

    /* The auto day score. Each configured component earns 1 point:
         fuel   — logged, calories within ±10% of target, protein ≥ 90% of target
         supps  — every supplement on the list ticked in that day's log
         train  — planned day: a workout logged; rest day: kept by default
         study  — minutes logged ≥ the daily target
       Components only count when their module is on and configured, so an
       unconfigured area never drags the score down. */
    dayScore: function (iso) {
      var possible = 0, earned = 0, parts = [];

      if (OD.moduleOn("fuel") && OD.db.fuelPlan) {
        possible++;
        var log = OD.goals.fuelLogFor(iso);
        var hit = false;
        if (log) {
          var kcal = OD.goals.kcalOf(log);
          var t = OD.db.fuelPlan;
          hit = Math.abs(kcal - t.kcal) <= t.kcal * 0.1 && (Number(log.protein) || 0) >= t.protein * 0.9;
        }
        if (hit) earned++;
        parts.push({ key: "fuel", label: "Macros", ok: hit, detail: log ? "logged" : "not logged" });
      }

      if (OD.moduleOn("fuel") && OD.db.supps.length) {
        possible++;
        var taken = OD.goals.suppsAllTaken(OD.goals.fuelLogFor(iso));
        if (taken) earned++;
        parts.push({ key: "supps", label: "Supplements", ok: taken });
      }

      if (OD.moduleOn("fitness")) {
        if (OD.goals.routineActive()) {
          possible++;
          var planned = OD.goals.plannedLabel(iso);
          var isRest = !planned || /^rest$/i.test(planned);
          var worked = OD.goals.workoutsOn(iso).length > 0;
          var kept = isRest ? true : worked;
          if (kept) earned++;
          parts.push({ key: "train", label: isRest ? "Rest day" : planned, ok: kept, detail: isRest ? "recovery counts" : (worked ? "trained" : "not yet") });
        } else if (OD.goals.workoutsOn(iso).length) {
          possible++; earned++;
          parts.push({ key: "train", label: "Trained", ok: true });
        }
      }

      if (OD.moduleOn("study") && (OD.db.studyPlan.target || 0) > 0) {
        possible++;
        var mins = OD.goals.studyMinutes(iso);
        var okS = mins >= OD.db.studyPlan.target;
        if (okS) earned++;
        parts.push({ key: "study", label: "Study " + OD.db.studyPlan.target + " min", ok: okS, detail: mins + " min" });
      }

      return { possible: possible, earned: earned, ratio: possible ? earned / possible : 0, parts: parts };
    },

    /* good ≥ 75% kept · warn = something kept · off = nothing tracked/kept */
    dayTone: function (iso) {
      var s = OD.goals.dayScore(iso);
      if (!s.possible) return "off";
      if (s.ratio >= 0.75) return "good";
      if (s.earned > 0) return "warn";
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

    /* the compounding curve: every kept day multiplies you by 1.01 */
    compound: function (days) {
      var out = [], value = 1;
      for (var i = days - 1; i >= 1; i--) {
        if (OD.goals.dayTone(OD.goals.dayISO(-i)) === "good") value *= 1.01;
        out.push({ date: OD.goals.dayISO(-i), value: value });
      }
      out.push({ date: OD.goals.dayISO(0), value: value });
      return out;
    }
  };
})();
