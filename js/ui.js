/* OpsDesk — shared UI: escaping, badges, toasts, modals, and a generic
   form modal every view uses for create/edit. */
(function () {
  "use strict";

  var ui = OD.ui = {};

  /* ---------- escaping — every dynamic value passes through this ---------- */

  ui.esc = function (s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  };

  /* ---------- badges ---------- */

  /* tone: good | warning | serious | critical | accent | plain */
  ui.badge = function (text, tone) {
    return '<span class="badge b-' + (tone || "plain") + '"><span class="dot"></span>' + ui.esc(text) + "</span>";
  };

  /* ---------- toast ---------- */

  ui.toast = function (msg, isError) {
    var root = document.getElementById("toast-root");
    if (!root) return;
    var t = document.createElement("div");
    t.className = "toast" + (isError ? " err" : "");
    t.textContent = msg;
    root.appendChild(t);
    setTimeout(function () {
      t.style.opacity = "0";
      t.style.transition = "opacity 0.25s";
      setTimeout(function () { t.remove(); }, 300);
    }, 2600);
  };

  /* ---------- modal plumbing ---------- */

  function closeModal() {
    var root = document.getElementById("modal-root");
    root.innerHTML = "";
    document.removeEventListener("keydown", onKey);
  }
  function onKey(e) {
    if (e.key === "Escape") closeModal();
  }
  ui.closeModal = closeModal;

  function openModal(html, narrow) {
    var root = document.getElementById("modal-root");
    root.innerHTML =
      '<div class="modal-overlay">' +
      '<div class="modal' + (narrow ? " narrow" : "") + '" role="dialog" aria-modal="true">' + html + "</div>" +
      "</div>";
    document.addEventListener("keydown", onKey);
    root.querySelector(".modal-overlay").addEventListener("mousedown", function (e) {
      if (e.target === e.currentTarget) closeModal();
    });
    var closeBtn = root.querySelector(".modal-close");
    if (closeBtn) closeBtn.addEventListener("click", closeModal);
    return root.querySelector(".modal");
  }
  ui.openModal = openModal;

  ui.modalHead = function (title) {
    return '<div class="modal-head"><h2>' + ui.esc(title) + '</h2><button class="modal-close" type="button" aria-label="Close">×</button></div>';
  };

  /* ---------- confirm ---------- */

  ui.confirm = function (opts, onYes) {
    if (typeof opts === "string") opts = { message: opts };
    var m = openModal(
      ui.modalHead(opts.title || "Are you sure?") +
      '<p class="subtle">' + ui.esc(opts.message || "") + "</p>" +
      '<div class="modal-actions">' +
      '<button class="btn" data-act="cancel" type="button">Cancel</button>' +
      '<button class="btn ' + (opts.danger === false ? "primary" : "danger") + '" data-act="yes" type="button">' +
      ui.esc(opts.confirmLabel || "Delete") + "</button></div>",
      true
    );
    m.querySelector('[data-act="cancel"]').addEventListener("click", closeModal);
    m.querySelector('[data-act="yes"]').addEventListener("click", function () {
      closeModal();
      onYes();
    });
  };

  /* ---------- generic form modal ----------
     fields: [{ key, label, type: text|number|date|select|textarea,
                options: ["a"] or [{value,label}], required, placeholder,
                step, span2, hint }]
     opts: { title, fields, values, submitLabel, onSubmit(values),
             onDelete (optional — shows a Delete button) } */

  ui.form = function (opts) {
    var values = opts.values || {};
    var body = '<form class="form-grid" novalidate>';

    opts.fields.forEach(function (f) {
      var val = values[f.key];
      if (val === undefined || val === null) val = f.default !== undefined ? f.default : "";
      var inner = "";
      var idAttr = "f-" + f.key;

      if (f.type === "select") {
        inner = '<select class="control" id="' + idAttr + '" name="' + f.key + '">';
        (f.options || []).forEach(function (o) {
          var ov = typeof o === "object" ? o.value : o;
          var ol = typeof o === "object" ? o.label : OD.fmt.title(o);
          inner += '<option value="' + ui.esc(ov) + '"' + (String(ov) === String(val) ? " selected" : "") + ">" + ui.esc(ol) + "</option>";
        });
        inner += "</select>";
      } else if (f.type === "textarea") {
        inner = '<textarea class="control" id="' + idAttr + '" name="' + f.key + '" placeholder="' + ui.esc(f.placeholder || "") + '">' + ui.esc(val) + "</textarea>";
      } else {
        inner = '<input class="control" id="' + idAttr + '" name="' + f.key + '" type="' + (f.type || "text") + '"' +
          (f.step ? ' step="' + f.step + '"' : "") +
          (f.type === "number" ? ' min="0" inputmode="decimal"' : "") +
          ' value="' + ui.esc(val) + '" placeholder="' + ui.esc(f.placeholder || "") + '">';
      }

      body +=
        '<div class="field' + (f.span2 ? " span-2" : "") + '">' +
        '<label for="' + idAttr + '">' + ui.esc(f.label) + (f.required ? ' <span class="req">*</span>' : "") + "</label>" +
        inner +
        (f.hint ? '<span class="hint">' + ui.esc(f.hint) + "</span>" : "") +
        "</div>";
    });

    body += '<div class="form-error span-2" hidden></div>';
    body += '<div class="modal-actions span-2">';
    if (opts.onDelete) body += '<button class="btn danger" type="button" data-act="delete">Delete</button>';
    body += '<button class="btn" type="button" data-act="cancel">Cancel</button>';
    body += '<button class="btn primary" type="submit">' + ui.esc(opts.submitLabel || "Save") + "</button>";
    body += "</div></form>";

    var m = openModal(ui.modalHead(opts.title) + body);
    var formEl = m.querySelector("form");
    var errEl = m.querySelector(".form-error");

    var first = formEl.querySelector(".control");
    if (first) first.focus();

    formEl.querySelector('[data-act="cancel"]').addEventListener("click", closeModal);
    if (opts.onDelete) {
      formEl.querySelector('[data-act="delete"]').addEventListener("click", function () {
        opts.onDelete();
      });
    }

    formEl.addEventListener("submit", function (e) {
      e.preventDefault();
      var out = {};
      var problem = "";

      opts.fields.forEach(function (f) {
        var el = formEl.querySelector('[name="' + f.key + '"]');
        var v = el ? el.value : "";
        if (f.type === "number") {
          v = v === "" ? "" : Number(v);
          if (v !== "" && (isNaN(v) || v < 0)) problem = problem || (f.label + " must be a non-negative number.");
        }
        if (f.required && (v === "" || v === null)) problem = problem || (f.label + " is required.");
        out[f.key] = v;
      });

      if (!problem && opts.validate) problem = opts.validate(out) || "";
      if (problem) {
        errEl.textContent = problem;
        errEl.hidden = false;
        return;
      }
      closeModal();
      opts.onSubmit(out);
    });
  };

  /* ---------- table shell ---------- */

  ui.table = function (headers, rowsHtml, emptyMsg) {
    if (!rowsHtml) return '<div class="empty">' + ui.esc(emptyMsg || "Nothing here yet.") + "</div>";
    var head = headers.map(function (h) {
      if (typeof h === "object") return '<th class="' + (h.cls || "") + '">' + ui.esc(h.label) + "</th>";
      return "<th>" + ui.esc(h) + "</th>";
    }).join("");
    return '<div class="table-wrap"><table class="data"><thead><tr>' + head + "</tr></thead><tbody>" + rowsHtml + "</tbody></table></div>";
  };
})();
