/* OpsDesk — dashboard: the morning-coffee view of everything. */
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
    items.sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    return items.slice(0, 8);
  }

  OD.views.dashboard = {
    title: "Dashboard",
    actions: function () { return []; },

    render: function (el) {
      var db = OD.db;
      var months = OD.lastMonths(6);
      var curKey = months[5], prevKey = months[4];
      var cur = OD.query.monthFlows(curKey);
      var prev = OD.query.monthFlows(prevKey);

      var running = db.vms.filter(function (v) { return v.status === "running"; }).length;
      var labVms = db.vms.filter(function (v) { return v.status !== "template"; }).length;
      var open = OD.query.openTickets();
      var highCount = open.filter(function (t) { return t.priority === "high"; }).length;
      var active = OD.query.activeJobs();
      var interviews = db.jobs.filter(function (j) { return j.status === "interview"; }).length;
      var modsDone = db.modules.filter(function (m) { return m.status === "done"; }).length;
      var modsPct = db.modules.length ? (modsDone / db.modules.length) * 100 : 0;

      var netDiff = cur.net - prev.net;
      var netDelta = (netDiff >= 0 ? "▲ " : "▼ ") + OD.fmt.moneyCompact(Math.abs(netDiff)) + " vs " + OD.fmt.monthLabel(prevKey);

      var now = new Date();
      var hi = now.getHours() < 12 ? "Good morning" : now.getHours() < 17 ? "Good afternoon" : "Good evening";
      var who = (db.settings.name || "").trim();
      var html = '<div class="greeting spread">' +
        "<h2>" + esc(hi + (who ? ", " + who : "")) + ".</h2>" +
        '<span class="hint">' + esc(now.toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric" })) + "</span>" +
        "</div>";

      if (db.settings.seeded && !db.settings.bannerDismissed) {
        html += '<div class="banner" style="margin-bottom:14px">' +
          "<span>You're looking at <b>sample data</b> modeled on a Niagara homelab. Edit anything, or start clean in Settings.</span>" +
          '<button class="btn sm right" data-act="dismiss-banner" type="button">Got it</button></div>';
      }

      var simple = OD.isSimple();
      html += '<div class="tiles">';
      if (OD.moduleOn("lab")) html += tile("Lab VMs running", String(running), "of " + labVms);
      if (OD.moduleOn("desk")) html += tile(simple ? "Open to-dos" : "Open tickets", String(open.length), "", highCount ? highCount + " high priority" : (open.length ? "none high priority" : "all clear"), highCount ? "down" : "");
      if (OD.moduleOn("ledger")) html += tile("Net this month", OD.fmt.moneyCompact(cur.net), "", netDelta, netDiff >= 0 ? "up" : "down");
      if (OD.moduleOn("pipeline")) html += tile("Active applications", String(active.length), "", interviews ? interviews + " at interview" : "", interviews ? "up" : "");
      if (OD.moduleOn("study")) {
        html += '<div class="tile"><div class="tile-label">' + (simple ? "Learning" : "Study progress") + "</div>" +
          '<div class="tile-value">' + modsDone + " <small>of " + db.modules.length + (simple ? " topics" : " modules") + "</small></div>" +
          '<div style="margin-top:8px">' + OD.charts.meter(modsPct) + "</div></div>";
      }
      html += "</div>";

      var chartCards = "";
      if (OD.moduleOn("ledger")) {
        chartCards += '<div class="card"><div class="card-title">' + (simple ? "Money in vs out — last 6 months" : "Cash flow — last 6 months") + '</div><div id="dash-cashflow"></div></div>';
      }
      if (OD.moduleOn("pipeline")) {
        chartCards += '<div class="card"><div class="card-title">Job pipeline</div><div id="dash-funnel"></div>' +
          '<p class="hint" style="margin-top:10px">Counts by current stage · ' +
          esc(String(db.jobs.filter(function (j) { return j.status === "rejected"; }).length)) + " closed out, " +
          esc(String(db.jobs.filter(function (j) { return j.status === "accepted"; }).length)) + " accepted</p></div>";
      }
      if (chartCards) html += '<div class="grid grid-2 section-gap">' + chartCards + "</div>";

      var openRows = open
        .slice()
        .sort(function (a, b) {
          var rank = { high: 0, medium: 1, low: 2 };
          return rank[a.priority] - rank[b.priority];
        })
        .slice(0, 5)
        .map(function (t) {
          var tone = t.priority === "high" ? "critical" : t.priority === "medium" ? "warning" : "plain";
          return '<tr class="clickable" data-goto="#/desk"><td class="mono fade">' + esc(t.num) + "</td><td>" + esc(t.title) + "</td>" +
            "<td>" + OD.ui.badge(t.priority, tone) + "</td><td>" + OD.ui.badge(t.status, t.status === "in-progress" ? "accent" : "warning") + "</td></tr>";
        })
        .join("");

      var feed = activityFeed().map(function (f) {
        return '<div class="feed-item"><span class="feed-date">' + esc(OD.fmt.date(f.date)) + "</span>" +
          '<span class="feed-tag">' + OD.ui.badge(f.tag, f.tone) + "</span><span>" + esc(f.text) + "</span></div>";
      }).join("");

      var bottomCards = "";
      if (OD.moduleOn("desk")) {
        bottomCards += '<div class="card"><div class="card-title">' + (simple ? "Open to-dos" : "Open tickets") + "</div>" +
          OD.ui.table(["#", "Title", "Priority", "Status"], openRows, simple ? "Nothing open — nice." : "No open tickets — the desk is quiet.") + "</div>";
      }
      bottomCards += '<div class="card"><div class="card-title">Recent activity</div>' +
        (feed ? '<div class="feed">' + feed + "</div>" : '<div class="empty">Activity from every module lands here.</div>') +
        "</div>";
      html += '<div class="grid grid-2 section-gap">' + bottomCards + "</div>";

      el.innerHTML = html;

      // charts (each card exists only when its module is on)
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
        var funnelRows = OD.enums.jobFunnel.map(function (s) {
          return {
            label: OD.fmt.title(s),
            value: OD.db.jobs.filter(function (j) { return j.status === s; }).length
          };
        });
        funnelEl.innerHTML = OD.charts.hbars(funnelRows);
      }

      // wiring
      var dismiss = el.querySelector('[data-act="dismiss-banner"]');
      if (dismiss) dismiss.addEventListener("click", function () {
        OD.db.settings.bannerDismissed = true;
        OD.store.save();
        OD.app.refresh();
      });
      el.querySelectorAll("[data-goto]").forEach(function (r) {
        r.addEventListener("click", function () { location.hash = r.getAttribute("data-goto"); });
      });
    }
  };
})();
