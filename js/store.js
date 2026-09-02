/* OpsDesk — data layer.
   One JSON document in localStorage; every view reads OD.db and calls
   OD.store.save() after a mutation. Import/export moves the same document. */
(function () {
  "use strict";

  window.OD = window.OD || {};
  OD.views = OD.views || {};
  OD.VERSION = "1.2.0";

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
      var simple = { dashboard: "Home", desk: "To-dos", ledger: "Money", pipeline: "Job hunt", study: "Learning", settings: "Settings", lab: "Lab" };
      return simple[view] || view;
    }
    var pro = { dashboard: "Dashboard", lab: "Lab", desk: "Desk", ledger: "Ledger", pipeline: "Pipeline", study: "Study", settings: "Settings" };
    return pro[view] || view;
  };

  /* ---------- blank document ---------- */

  function defaultSettings() {
    return {
      name: "", theme: "auto", seeded: false, bannerDismissed: false,
      mode: "pro", onboarded: false,
      modules: { lab: true, desk: true, ledger: true, pipeline: true, study: true }
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
      commands: []
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
})();
