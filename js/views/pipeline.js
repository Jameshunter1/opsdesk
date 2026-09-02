/* OpsDesk — Pipeline: the job hunt, run like a funnel.
   Every application is a record with a stage, the resume version it used,
   and a dated activity log — so follow-ups never rely on memory. */
(function () {
  "use strict";

  var esc = function (s) { return OD.ui.esc(s); };

  var filterStatus = "all";
  var search = "";

  var STATUS_TONE = {
    saved: "plain", applied: "accent", screening: "accent",
    interview: "warning", offer: "good", accepted: "good", rejected: "critical"
  };

  function jobForm(j) {
    OD.ui.form({
      title: j ? "Edit — " + j.company : "New application",
      values: j,
      fields: [
        { key: "company", label: "Company", required: true },
        { key: "role", label: "Role", required: true, placeholder: "Service Desk Analyst" },
        { key: "source", label: "Source", placeholder: "Indeed / LinkedIn / referral" },
        { key: "url", label: "Posting URL", placeholder: "https://…" },
        { key: "resume", label: "Resume version used", placeholder: "IT resume v12" },
        { key: "salary", label: "Salary / rate", placeholder: "CAD 26/hr" },
        { key: "status", label: "Stage", type: "select", options: OD.enums.jobStatus },
        { key: "applied", label: "Applied on", type: "date" },
        { key: "notes", label: "Notes", type: "textarea", span2: true, placeholder: "Why this one, what to emphasize, who you talked to" }
      ],
      onSubmit: function (v) {
        if (j) Object.assign(j, v);
        else {
          v.id = OD.uid();
          v.activity = [];
          if (v.status !== "saved" && !v.applied) v.applied = OD.todayISO();
          OD.db.jobs.push(v);
        }
        OD.store.save();
        OD.app.refresh();
        OD.ui.toast(j ? "Application updated." : "Application tracked.");
      },
      onDelete: j && function () {
        OD.ui.confirm({ title: "Delete application?", message: j.company + " — " + j.role }, function () {
          OD.db.jobs = OD.db.jobs.filter(function (x) { return x.id !== j.id; });
          OD.store.save();
          OD.app.refresh();
          OD.ui.toast("Application deleted.");
        });
      }
    });
  }

  function jobDetail(j) {
    var log = (j.activity || [])
      .slice()
      .sort(function (a, b) { return a.date < b.date ? 1 : -1; })
      .map(function (a) {
        return '<div class="feed-item"><span class="feed-date">' + esc(OD.fmt.date(a.date)) + "</span><span>" + esc(a.note) + "</span></div>";
      }).join("");

    var stageSel = OD.enums.jobStatus.map(function (s) {
      return '<option value="' + s + '"' + (j.status === s ? " selected" : "") + ">" + OD.fmt.title(s) + "</option>";
    }).join("");

    var m = OD.ui.openModal(
      OD.ui.modalHead(j.company + " — " + j.role) +
      '<dl class="detail-grid">' +
      "<dt>Stage</dt><dd>" + OD.ui.badge(j.status, STATUS_TONE[j.status]) + "</dd>" +
      "<dt>Source</dt><dd>" + esc(j.source || "—") + "</dd>" +
      "<dt>Applied</dt><dd>" + esc(OD.fmt.dateFull(j.applied)) + "</dd>" +
      "<dt>Resume</dt><dd>" + esc(j.resume || "—") + "</dd>" +
      "<dt>Salary</dt><dd>" + esc(j.salary || "—") + "</dd>" +
      (j.url ? '<dt>Posting</dt><dd><a href="' + esc(j.url) + '" target="_blank" rel="noopener">open ↗</a></dd>' : "") +
      (j.notes ? "<dt>Notes</dt><dd>" + esc(j.notes) + "</dd>" : "") +
      "</dl>" +
      '<div class="card-title" style="margin-top:16px">Activity</div>' +
      (log ? '<div class="feed">' + log + "</div>" : '<p class="hint">No activity logged yet.</p>') +
      '<div class="row" style="margin-top:10px">' +
      '<input class="control" id="job-note" placeholder="Log a call, an email, a follow-up…" style="flex:1">' +
      '<button class="btn" id="job-note-add" type="button">Log it</button></div>' +
      '<div class="modal-actions">' +
      '<button class="btn ghost" data-act="edit" type="button">Edit</button>' +
      '<label class="row" style="gap:6px"><span class="hint">Move to</span>' +
      '<select class="control" id="job-stage" style="width:auto">' + stageSel + "</select></label>" +
      "</div>"
    );

    m.querySelector('[data-act="edit"]').addEventListener("click", function () {
      OD.ui.closeModal();
      jobForm(j);
    });

    function addNote() {
      var input = m.querySelector("#job-note");
      var note = input.value.trim();
      if (!note) return;
      j.activity = j.activity || [];
      j.activity.push({ date: OD.todayISO(), note: note });
      OD.store.save();
      OD.ui.closeModal();
      OD.app.refresh();
      jobDetail(j);
    }
    m.querySelector("#job-note-add").addEventListener("click", addNote);
    m.querySelector("#job-note").addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); addNote(); }
    });

    m.querySelector("#job-stage").addEventListener("change", function (e) {
      var to = e.target.value;
      j.status = to;
      if (to === "applied" && !j.applied) j.applied = OD.todayISO();
      j.activity = j.activity || [];
      j.activity.push({ date: OD.todayISO(), note: "Moved to " + OD.fmt.title(to) + "." });
      OD.store.save();
      OD.ui.closeModal();
      OD.app.refresh();
      OD.ui.toast(j.company + " → " + OD.fmt.title(to));
    });
  }

  function lastTouch(j) {
    var dates = (j.activity || []).map(function (a) { return a.date; });
    if (j.applied) dates.push(j.applied);
    dates.sort();
    return dates.length ? dates[dates.length - 1] : "";
  }

  OD.views.pipeline = {
    title: "Pipeline",
    actions: function () {
      return [{ label: "+ Application", primary: true, onClick: function () { jobForm(null); } }];
    },

    render: function (el) {
      var db = OD.db;
      var active = OD.query.activeJobs();
      var curKey = OD.lastMonths(1)[0];
      var appliedThisMonth = db.jobs.filter(function (j) { return OD.monthKey(j.applied) === curKey; }).length;
      var interviews = db.jobs.filter(function (j) { return j.status === "interview"; }).length;
      var offers = db.jobs.filter(function (j) { return j.status === "offer" || j.status === "accepted"; }).length;

      var html = '<div class="tiles">' +
        '<div class="tile"><div class="tile-label">Active applications</div><div class="tile-value">' + active.length + "</div></div>" +
        '<div class="tile"><div class="tile-label">Applied — ' + esc(OD.fmt.monthLabel(curKey)) + '</div><div class="tile-value">' + appliedThisMonth + "</div></div>" +
        '<div class="tile"><div class="tile-label">At interview</div><div class="tile-value">' + interviews + "</div></div>" +
        '<div class="tile"><div class="tile-label">Offers</div><div class="tile-value">' + offers + "</div></div>" +
        "</div>";

      var list = db.jobs
        .filter(function (j) { return filterStatus === "all" || j.status === filterStatus; })
        .filter(function (j) {
          if (!search) return true;
          var q = search.toLowerCase();
          return [j.company, j.role, j.source, j.resume, j.notes].join(" ").toLowerCase().indexOf(q) !== -1;
        })
        .slice()
        .sort(function (a, b) { return lastTouch(a) < lastTouch(b) ? 1 : -1; });

      var rows = list.map(function (j) {
        return '<tr class="clickable" data-job="' + j.id + '">' +
          "<td><b>" + esc(j.company) + "</b></td>" +
          "<td>" + esc(j.role) + "</td>" +
          "<td>" + OD.ui.badge(j.status, STATUS_TONE[j.status]) + "</td>" +
          '<td class="fade">' + esc(j.source || "—") + "</td>" +
          '<td class="fade">' + esc(j.resume || "—") + "</td>" +
          '<td class="fade">' + esc(OD.fmt.date(lastTouch(j))) + "</td></tr>";
      }).join("");

      html += '<div class="card section-gap">' +
        '<div class="filters">' +
        '<select class="control" id="pipe-status"><option value="all">All stages</option>' +
        OD.enums.jobStatus.map(function (s) {
          return '<option value="' + s + '"' + (filterStatus === s ? " selected" : "") + ">" + OD.fmt.title(s) + "</option>";
        }).join("") + "</select>" +
        '<input class="control search-input" id="pipe-search" type="search" placeholder="Search company, role, notes…" value="' + esc(search) + '">' +
        "</div>" +
        OD.ui.table(["Company", "Role", "Stage", "Source", "Resume", "Last touch"], rows,
          db.jobs.length ? "Nothing matches that filter." : "Track your first application — the funnel builds itself.") +
        "</div>";

      el.innerHTML = html;

      el.querySelectorAll("[data-job]").forEach(function (r) {
        r.addEventListener("click", function () {
          jobDetail(db.jobs.find(function (j) { return j.id === r.getAttribute("data-job"); }));
        });
      });
      el.querySelector("#pipe-status").addEventListener("change", function (e) {
        filterStatus = e.target.value;
        OD.app.refresh();
      });
      var searchEl = el.querySelector("#pipe-search");
      searchEl.addEventListener("input", function () {
        search = searchEl.value;
        var pos = searchEl.selectionStart;
        OD.app.refresh();
        var again = document.getElementById("pipe-search");
        if (again) { again.focus(); again.setSelectionRange(pos, pos); }
      });
    }
  };
})();
