/* OpsDesk — shell: hash router, theme, topbar actions, nav state. */
(function () {
  "use strict";

  var app = OD.app = {};
  var current = "dashboard";

  /* ---------- theme ---------- */

  app.applyTheme = function () {
    var t = OD.db.settings.theme || "auto";
    if (t === "auto") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", t);
    var label = document.getElementById("theme-label");
    if (label) label.textContent = t === "auto" ? "System" : t === "light" ? "Light" : "Dark";
  };

  function cycleTheme() {
    var order = ["auto", "light", "dark"];
    var t = OD.db.settings.theme || "auto";
    OD.db.settings.theme = order[(order.indexOf(t) + 1) % order.length];
    OD.store.save();
    app.applyTheme();
    app.refresh(); // charts and badges pick up the new tokens
  }

  /* ---------- routing ---------- */

  function routeName() {
    var h = location.hash.replace(/^#\//, "");
    return OD.views[h] ? h : "dashboard";
  }

  app.render = function () {
    current = routeName();
    var view = OD.views[current];

    document.getElementById("view-title").textContent = view.title;
    document.title = view.title + " · OpsDesk";

    // topbar actions
    var actionsEl = document.getElementById("topbar-actions");
    actionsEl.innerHTML = "";
    (view.actions ? view.actions() : []).forEach(function (a) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "btn" + (a.primary ? " primary" : "");
      b.textContent = a.label;
      b.addEventListener("click", a.onClick);
      actionsEl.appendChild(b);
    });

    // active nav link + desk badge
    document.querySelectorAll(".nav-link").forEach(function (l) {
      l.classList.toggle("active", l.getAttribute("data-view") === current);
    });
    var badge = document.getElementById("nav-badge-desk");
    var open = OD.query.openTickets().length;
    badge.hidden = open === 0;
    badge.textContent = open;

    view.render(document.getElementById("view"));
  };

  /* Re-render the current view in place, keeping scroll position. */
  app.refresh = function () {
    var y = window.scrollY;
    app.render();
    window.scrollTo(0, y);
  };

  /* ---------- boot ---------- */

  document.addEventListener("DOMContentLoaded", function () {
    OD.store.init();
    app.applyTheme();

    document.getElementById("theme-toggle").addEventListener("click", cycleTheme);
    window.addEventListener("hashchange", app.render);

    // charts re-fit on resize (dashboard is the only chart-heavy view)
    var timer = null;
    window.addEventListener("resize", function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        if (current === "dashboard") app.refresh();
      }, 200);
    });

    if (!location.hash) location.hash = "#/dashboard";
    app.render();

    // installable + offline when served over http(s); harmless no-op on file://
    if ("serviceWorker" in navigator && location.protocol.indexOf("http") === 0) {
      navigator.serviceWorker.register("sw.js").catch(function () { /* offline support is optional */ });
    }
  });
})();
