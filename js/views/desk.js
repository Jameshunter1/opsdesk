/* OpsDesk — Desk: a personal service desk.
   Incidents and tasks get numbered tickets; every resolved ticket with a
   lesson becomes a knowledge-base article. Cause → fix → lesson, always. */
(function () {
  "use strict";

  var esc = function (s) { return OD.ui.esc(s); };

  var tab = "tickets";
  var filterStatus = "all";
  var search = "";

  var PRIORITY_TONE = { high: "critical", medium: "warning", low: "plain" };
  var STATUS_TONE = { open: "warning", "in-progress": "accent", resolved: "good" };

  function ticketForm(t) {
    OD.ui.form({
      title: t ? "Edit " + t.num : "New ticket",
      values: t,
      fields: [
        { key: "title", label: "Title", required: true, span2: true, placeholder: "Short, searchable summary of the problem or task" },
        { key: "type", label: "Type", type: "select", options: OD.enums.ticketType },
        { key: "area", label: "Area", type: "select", options: OD.enums.ticketArea },
        { key: "priority", label: "Priority", type: "select", options: OD.enums.ticketPriority, default: "medium" },
        { key: "status", label: "Status", type: "select", options: OD.enums.ticketStatus },
        { key: "symptom", label: "Symptom", type: "textarea", span2: true, placeholder: "What it looked like from the outside" },
        { key: "cause", label: "Root cause", type: "textarea", span2: true, placeholder: "The actual reason — not the first scary error line" },
        { key: "fix", label: "Fix / plan", type: "textarea", span2: true, placeholder: "What resolved it, or the steps to take" },
        { key: "lesson", label: "Lesson", type: "textarea", span2: true, placeholder: "The one-liner future-you needs. This is what goes in the KB." }
      ],
      onSubmit: function (v) {
        if (t) {
          var wasResolved = t.status === "resolved";
          Object.assign(t, v);
          if (v.status === "resolved" && !wasResolved && !t.resolved) t.resolved = OD.todayISO();
          if (v.status !== "resolved") t.resolved = "";
        } else {
          v.id = OD.uid();
          v.num = OD.query.nextTicketNumber();
          v.opened = OD.todayISO();
          v.resolved = v.status === "resolved" ? OD.todayISO() : "";
          OD.db.tickets.push(v);
        }
        OD.store.save();
        OD.app.refresh();
        OD.ui.toast(t ? "Ticket updated." : "Ticket " + (t ? t.num : OD.db.tickets[OD.db.tickets.length - 1].num) + " opened.");
      },
      onDelete: t && function () {
        OD.ui.confirm({ title: "Delete ticket?", message: t.num + " and its KB entry will be gone for good." }, function () {
          OD.db.tickets = OD.db.tickets.filter(function (x) { return x.id !== t.id; });
          OD.store.save();
          OD.app.refresh();
          OD.ui.toast("Ticket deleted.");
        });
      }
    });
  }

  function block(label, text) {
    if (!text) return "";
    return '<div class="kb-part"><b>' + esc(label) + '</b><div class="prose-block">' + esc(text) + "</div></div>";
  }

  function ticketDetail(t) {
    var actions = "";
    if (t.status === "open") actions += '<button class="btn" data-act="start" type="button">Start work</button>';
    if (t.status !== "resolved") actions += '<button class="btn primary" data-act="resolve" type="button">Resolve</button>';
    else actions += '<button class="btn" data-act="reopen" type="button">Reopen</button>';

    var m = OD.ui.openModal(
      OD.ui.modalHead(t.num + " — " + t.title) +
      '<div class="row" style="margin-bottom:12px">' +
      OD.ui.badge(t.type, "plain") + OD.ui.badge(t.area, "plain") +
      OD.ui.badge(t.priority, PRIORITY_TONE[t.priority]) + OD.ui.badge(t.status, STATUS_TONE[t.status]) +
      '<span class="hint right">opened ' + esc(OD.fmt.dateFull(t.opened)) +
      (t.resolved ? " · resolved " + esc(OD.fmt.dateFull(t.resolved)) : "") + "</span></div>" +
      block("Symptom", t.symptom) + block("Root cause", t.cause) + block("Fix", t.fix) + block("Lesson", t.lesson) +
      '<div class="modal-actions"><button class="btn ghost" data-act="edit" type="button">Edit</button>' + actions + "</div>"
    );

    m.querySelector('[data-act="edit"]').addEventListener("click", function () {
      OD.ui.closeModal();
      ticketForm(t);
    });
    var start = m.querySelector('[data-act="start"]');
    if (start) start.addEventListener("click", function () {
      t.status = "in-progress";
      OD.store.save(); OD.ui.closeModal(); OD.app.refresh();
    });
    var resolve = m.querySelector('[data-act="resolve"]');
    if (resolve) resolve.addEventListener("click", function () {
      t.status = "resolved";
      t.resolved = OD.todayISO();
      OD.store.save(); OD.ui.closeModal(); OD.app.refresh();
      OD.ui.toast(t.lesson ? t.num + " resolved and filed in the KB." : t.num + " resolved — add a lesson to file it in the KB.");
    });
    var reopen = m.querySelector('[data-act="reopen"]');
    if (reopen) reopen.addEventListener("click", function () {
      t.status = "open";
      t.resolved = "";
      OD.store.save(); OD.ui.closeModal(); OD.app.refresh();
    });
  }

  function matches(t, q) {
    if (!q) return true;
    q = q.toLowerCase();
    return [t.num, t.title, t.symptom, t.cause, t.fix, t.lesson, t.area].join(" ").toLowerCase().indexOf(q) !== -1;
  }

  OD.views.desk = {
    title: "Desk",
    actions: function () {
      return [{ label: "+ New ticket", primary: true, onClick: function () { ticketForm(null); } }];
    },

    render: function (el) {
      var db = OD.db;
      var kbCount = db.tickets.filter(function (t) { return t.status === "resolved" && t.lesson; }).length;

      var html = '<div class="filters">' +
        '<button class="btn sm' + (tab === "tickets" ? " primary" : "") + '" data-tab="tickets" type="button">Tickets (' + db.tickets.length + ")</button>" +
        '<button class="btn sm' + (tab === "kb" ? " primary" : "") + '" data-tab="kb" type="button">Knowledge base (' + kbCount + ")</button>" +
        '<span class="right"></span>';

      if (tab === "tickets") {
        html += '<select class="control" id="desk-status"><option value="all"' + (filterStatus === "all" ? " selected" : "") + ">All statuses</option>" +
          OD.enums.ticketStatus.map(function (s) {
            return '<option value="' + s + '"' + (filterStatus === s ? " selected" : "") + ">" + OD.fmt.title(s) + "</option>";
          }).join("") + "</select>";
      }
      html += '<input class="control search-input" id="desk-search" type="search" placeholder="Search title, cause, lesson…" value="' + esc(search) + '"></div>';

      if (tab === "tickets") {
        var list = db.tickets
          .filter(function (t) { return filterStatus === "all" || t.status === filterStatus; })
          .filter(function (t) { return matches(t, search); })
          .slice()
          .sort(function (a, b) { return a.opened < b.opened ? 1 : -1; });

        var rows = list.map(function (t) {
          return '<tr class="clickable" data-ticket="' + t.id + '">' +
            '<td class="mono fade">' + esc(t.num) + "</td>" +
            "<td><b>" + esc(t.title) + "</b></td>" +
            "<td>" + OD.ui.badge(t.type, "plain") + "</td>" +
            "<td>" + esc(t.area) + "</td>" +
            "<td>" + OD.ui.badge(t.priority, PRIORITY_TONE[t.priority]) + "</td>" +
            "<td>" + OD.ui.badge(t.status, STATUS_TONE[t.status]) + "</td>" +
            '<td class="fade">' + esc(OD.fmt.date(t.opened)) + "</td></tr>";
        }).join("");

        html += '<div class="card">' +
          OD.ui.table(["#", "Title", "Type", "Area", "Priority", "Status", "Opened"], rows,
            db.tickets.length ? "Nothing matches that filter." : "Open your first ticket — future-you will thank present-you.") +
          "</div>";
      } else {
        var articles = db.tickets
          .filter(function (t) { return t.status === "resolved" && t.lesson && matches(t, search); })
          .slice()
          .sort(function (a, b) { return (a.resolved || "") < (b.resolved || "") ? 1 : -1; });

        var cards = articles.map(function (t) {
          return '<div class="kb-card clickable" data-ticket="' + t.id + '" style="cursor:pointer">' +
            '<div class="spread"><span class="kb-title">' + esc(t.title) + '</span><span class="hint mono">' + esc(t.num) + "</span></div>" +
            block("Root cause", t.cause) + block("Fix", t.fix) + block("Lesson", t.lesson) +
            "</div>";
        }).join("");

        html += '<div class="card">' +
          (cards || '<div class="empty">Resolve a ticket and write its lesson — it shows up here as an article.</div>') +
          "</div>";
      }

      el.innerHTML = html;

      /* wiring */
      el.querySelectorAll("[data-tab]").forEach(function (b) {
        b.addEventListener("click", function () {
          tab = b.getAttribute("data-tab");
          OD.app.refresh();
        });
      });
      var statusSel = el.querySelector("#desk-status");
      if (statusSel) statusSel.addEventListener("change", function () {
        filterStatus = statusSel.value;
        OD.app.refresh();
      });
      var searchEl = el.querySelector("#desk-search");
      searchEl.addEventListener("input", function () {
        search = searchEl.value;
        var pos = searchEl.selectionStart;
        OD.app.refresh();
        var again = document.getElementById("desk-search");
        if (again) { again.focus(); again.setSelectionRange(pos, pos); }
      });
      el.querySelectorAll("[data-ticket]").forEach(function (r) {
        r.addEventListener("click", function () {
          ticketDetail(db.tickets.find(function (t) { return t.id === r.getAttribute("data-ticket"); }));
        });
      });
    }
  };
})();
