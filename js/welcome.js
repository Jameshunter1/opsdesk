/* OpsDesk — first-run welcome.
   One question before anything else: what should this be for you?
   The answer picks the mode, the modules, and the starter data. */
(function () {
  "use strict";

  var esc = function (s) { return OD.ui.esc(s); };

  function choose(mode) {
    var name = (document.getElementById("welcome-name") || { value: "" }).value.trim();
    if (mode === "simple") {
      OD.store.resetToSimple(name);
    } else {
      OD.store.resetToSeed();
      OD.db.settings.name = name;
      OD.store.save();
    }
    var overlay = document.getElementById("welcome-overlay");
    if (overlay) overlay.remove();
    OD.app.applyTheme();
    location.hash = "#/dashboard";
    OD.app.render();
    OD.ui.toast(mode === "simple"
      ? "Set up for everyday use. Everything stays on this device."
      : "Demo homelab loaded — make it yours, or start blank in Settings.");
  }

  function show() {
    var el = document.createElement("div");
    el.id = "welcome-overlay";
    el.innerHTML =
      '<div class="welcome-card">' +
      '<div class="welcome-brand">' +
      '<svg viewBox="0 0 32 32" width="40" height="40"><rect width="32" height="32" rx="7" fill="var(--accent)"/><path d="M9 11l6 5-6 5" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M17 22h7" stroke="#fff" stroke-width="3" stroke-linecap="round"/></svg>' +
      "<h1>Welcome to OpsDesk</h1>" +
      '<p class="subtle">Projects, workouts, food, study, money, to-dos — one place,<br>scored on a simple idea: get 1% better on the days you show up.<br>Everything stays on this device — no account, nothing uploaded.</p>' +
      "</div>" +

      '<div class="field welcome-name"><label for="welcome-name">What should we call you? <span class="hint">(optional)</span></label>' +
      '<input class="control" id="welcome-name" placeholder="Your first name" autocomplete="given-name"></div>' +

      '<div class="welcome-choices">' +
      '<button class="welcome-choice" data-mode="simple" type="button">' +
      "<h2>Keep it simple</h2>" +
      '<p>Plain words for everything: projects with a clear next step, workout and food logging, spending as "I spent money / I got paid", a to-do list, and what you\'re learning. The dashboard scores your day automatically.</p>' +
      '<span class="welcome-tag">Recommended to start</span>' +
      "</button>" +
      '<button class="welcome-choice" data-mode="pro" type="button">' +
      "<h2>The full IT department</h2>" +
      "<p>Everything on the left, plus a homelab tracker (VMs, network zones, firewall rules), a ticket system with a knowledge base, and double-entry books — loaded with demo data to explore.</p>" +
      '<span class="welcome-tag alt">For IT folks & the curious</span>' +
      "</button>" +
      "</div>" +

      '<p class="hint" style="text-align:center;margin-top:18px">Not a forever choice — switch modes or turn modules on and off anytime in Settings.</p>' +
      "</div>";

    document.body.appendChild(el);
    el.querySelectorAll(".welcome-choice").forEach(function (btn) {
      btn.addEventListener("click", function () { choose(btn.getAttribute("data-mode")); });
    });
    var nameInput = el.querySelector("#welcome-name");
    if (nameInput) nameInput.focus();
  }

  OD.welcome = { show: show, choose: choose };
})();
