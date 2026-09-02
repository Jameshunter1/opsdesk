/* OpsDesk — Ledger: honest double-entry bookkeeping.
   Every transaction moves value from one account to another (credit → debit),
   so the books always balance and the trial balance proves it. */
(function () {
  "use strict";

  var esc = function (s) { return OD.ui.esc(s); };

  var filterMonth = "all";
  var filterAccount = "all";

  var TYPE_ORDER = ["asset", "liability", "equity", "income", "expense"];

  function accountOptions() {
    return OD.db.accounts
      .slice()
      .sort(function (a, b) { return TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type); })
      .map(function (a) { return { value: a.id, label: a.name + " (" + a.type + ")" }; });
  }

  function typeOptions() {
    if (!OD.isSimple()) return OD.enums.accountTypes;
    return [
      { value: "asset", label: "Money I have (bank, cash)" },
      { value: "liability", label: "Money I owe (credit card, loan)" },
      { value: "income", label: "Money coming in (pay, benefits)" },
      { value: "expense", label: "A spending category" },
      { value: "equity", label: "Starting balance (advanced)" }
    ];
  }

  function accountForm(a) {
    OD.ui.form({
      title: a ? "Edit account — " + a.name : (OD.isSimple() ? "New account or category" : "New account"),
      values: a,
      fields: [
        { key: "name", label: "Name", required: true, placeholder: OD.isSimple() ? "Groceries, Chequing, Visa…" : "Chequing" },
        {
          key: "type", label: "What is it?", type: "select", options: typeOptions(), required: true,
          hint: OD.isSimple()
            ? "Pick the closest — you can change it later."
            : "Assets and expenses grow with debits; the other three grow with credits."
        }
      ],
      onSubmit: function (v) {
        if (a) Object.assign(a, v);
        else { v.id = OD.uid(); OD.db.accounts.push(v); }
        OD.store.save();
        OD.app.refresh();
        OD.ui.toast(a ? "Account updated." : "Account added.");
      },
      onDelete: a && function () {
        var used = OD.db.txns.some(function (t) { return t.debit === a.id || t.credit === a.id; });
        if (used) {
          OD.ui.toast("This account has transactions — delete or re-point those first.", true);
          return;
        }
        OD.ui.confirm({ title: "Delete account?", message: 'Remove "' + a.name + '".' }, function () {
          OD.db.accounts = OD.db.accounts.filter(function (x) { return x.id !== a.id; });
          OD.store.save();
          OD.app.refresh();
          OD.ui.toast("Account deleted.");
        });
      }
    });
  }

  function txnForm(t) {
    if (OD.db.accounts.length < 2) {
      OD.ui.toast("Add at least two accounts first — money has to come from somewhere and go somewhere.", true);
      return;
    }
    OD.ui.form({
      title: t ? "Edit transaction" : "New transaction",
      values: t,
      fields: [
        { key: "date", label: "Date", type: "date", required: true, default: OD.todayISO() },
        { key: "amount", label: "Amount (CAD)", type: "number", step: "0.01", required: true },
        { key: "desc", label: "Description", required: true, span2: true, placeholder: "CompTIA Network+ exam voucher" },
        {
          key: "debit", label: "Debit — where value goes", type: "select", options: accountOptions(), required: true,
          hint: "Spending? Debit the expense. Getting paid? Debit chequing."
        },
        {
          key: "credit", label: "Credit — where value comes from", type: "select", options: accountOptions(), required: true,
          hint: "Spending? Credit the account you paid with. Getting paid? Credit income."
        }
      ],
      validate: function (v) {
        if (v.debit === v.credit) return "Debit and credit can't be the same account.";
        if (!(v.amount > 0)) return "Amount must be greater than zero.";
        return "";
      },
      onSubmit: function (v) {
        if (t) Object.assign(t, v);
        else { v.id = OD.uid(); OD.db.txns.push(v); }
        OD.store.save();
        OD.app.refresh();
        OD.ui.toast(t ? "Transaction updated." : "Posted. Books still balance — they can't not.");
      },
      onDelete: t && function () {
        OD.ui.confirm({ title: "Delete transaction?", message: t.desc + " · " + OD.fmt.money(t.amount) }, function () {
          OD.db.txns = OD.db.txns.filter(function (x) { return x.id !== t.id; });
          OD.store.save();
          OD.app.refresh();
          OD.ui.toast("Transaction deleted.");
        });
      }
    });
  }

  /* ---------- simple mode: plain-language entry ----------
     "I spent money / I got paid / I moved money" — each writes a correct
     double-entry transaction underneath, so switching to pro mode later
     finds real books, not a pile of unsorted amounts. */

  function accountsOf() {
    var types = Array.prototype.slice.call(arguments);
    return OD.db.accounts
      .filter(function (a) { return types.indexOf(a.type) !== -1; })
      .map(function (a) { return { value: a.id, label: a.name }; });
  }

  function saveSimple(t, v, debit, credit, fallbackDesc) {
    var data = { date: v.date, amount: v.amount, desc: (v.note || "").trim() || fallbackDesc, debit: debit, credit: credit };
    if (t) Object.assign(t, data);
    else { data.id = OD.uid(); OD.db.txns.push(data); }
    OD.store.save();
    OD.app.refresh();
    OD.ui.toast(t ? "Updated." : "Saved.");
  }

  function simpleDelete(t) {
    return t && function () {
      OD.ui.confirm({ title: "Delete this?", message: t.desc + " · " + OD.fmt.money(t.amount) }, function () {
        OD.db.txns = OD.db.txns.filter(function (x) { return x.id !== t.id; });
        OD.store.save();
        OD.app.refresh();
        OD.ui.toast("Deleted.");
      });
    };
  }

  function spentForm(t) {
    var cats = accountsOf("expense");
    var paidWith = accountsOf("asset", "liability");
    if (!cats.length || !paidWith.length) {
      OD.ui.toast("Add a spending category and an account first (+ Account).", true);
      return;
    }
    OD.ui.form({
      title: "I spent money",
      values: t ? { amount: t.amount, date: t.date, category: t.debit, paidWith: t.credit, note: t.desc } : null,
      fields: [
        { key: "amount", label: "How much?", type: "number", step: "0.01", required: true },
        { key: "date", label: "When?", type: "date", required: true, default: OD.todayISO() },
        { key: "category", label: "On what?", type: "select", options: cats, required: true },
        { key: "paidWith", label: "Paid with", type: "select", options: paidWith, required: true },
        { key: "note", label: "Note", span2: true, placeholder: "Optional — e.g. birthday gift for Mom" }
      ],
      validate: function (v) { return v.amount > 0 ? "" : "Amount must be more than zero."; },
      onSubmit: function (v) {
        saveSimple(t, v, v.category, v.paidWith, OD.query.accountName(v.category));
      },
      onDelete: simpleDelete(t)
    });
  }

  function gotPaidForm(t) {
    var sources = accountsOf("income");
    var into = accountsOf("asset");
    if (!sources.length || !into.length) {
      OD.ui.toast("Add an income source and a bank account first (+ Account).", true);
      return;
    }
    OD.ui.form({
      title: "I got paid",
      values: t ? { amount: t.amount, date: t.date, source: t.credit, into: t.debit, note: t.desc } : null,
      fields: [
        { key: "amount", label: "How much?", type: "number", step: "0.01", required: true },
        { key: "date", label: "When?", type: "date", required: true, default: OD.todayISO() },
        { key: "source", label: "From", type: "select", options: sources, required: true },
        { key: "into", label: "Into", type: "select", options: into, required: true },
        { key: "note", label: "Note", span2: true, placeholder: "Optional — e.g. September pay" }
      ],
      validate: function (v) { return v.amount > 0 ? "" : "Amount must be more than zero."; },
      onSubmit: function (v) {
        saveSimple(t, v, v.into, v.source, OD.query.accountName(v.source));
      },
      onDelete: simpleDelete(t)
    });
  }

  function moveForm(t) {
    var accts = accountsOf("asset", "liability");
    if (accts.length < 2) {
      OD.ui.toast("You need two accounts to move money between (+ Account).", true);
      return;
    }
    OD.ui.form({
      title: "I moved money",
      values: t ? { amount: t.amount, date: t.date, from: t.credit, to: t.debit, note: t.desc } : null,
      fields: [
        { key: "amount", label: "How much?", type: "number", step: "0.01", required: true },
        { key: "date", label: "When?", type: "date", required: true, default: OD.todayISO() },
        { key: "from", label: "From", type: "select", options: accts, required: true },
        {
          key: "to", label: "To", type: "select", options: accts, required: true,
          hint: "Paying off a credit card counts — move money from Chequing to the card."
        },
        { key: "note", label: "Note", span2: true, placeholder: "Optional" }
      ],
      validate: function (v) {
        if (v.from === v.to) return "Pick two different accounts.";
        return v.amount > 0 ? "" : "Amount must be more than zero.";
      },
      onSubmit: function (v) {
        saveSimple(t, v, v.to, v.from, "Transfer");
      },
      onDelete: simpleDelete(t)
    });
  }

  function addChooser() {
    var m = OD.ui.openModal(
      OD.ui.modalHead("Add money in or out") +
      '<div class="stack-choices">' +
      '<button class="big-choice" data-kind="spent" type="button"><b>I spent money</b><span>Groceries, bills, anything you paid for</span></button>' +
      '<button class="big-choice" data-kind="paid" type="button"><b>I got paid</b><span>Pay, benefits, gifts, refunds</span></button>' +
      '<button class="big-choice" data-kind="move" type="button"><b>I moved money</b><span>Between accounts, or paying off a card</span></button>' +
      "</div>", true
    );
    m.querySelectorAll(".big-choice").forEach(function (b) {
      b.addEventListener("click", function () {
        var kind = b.getAttribute("data-kind");
        OD.ui.closeModal();
        if (kind === "spent") spentForm(null);
        else if (kind === "paid") gotPaidForm(null);
        else moveForm(null);
      });
    });
  }

  /* Route a click on an existing transaction to the right simple form. */
  function openSimpleTxn(t) {
    var d = OD.query.accountById(t.debit);
    var c = OD.query.accountById(t.credit);
    if (d && d.type === "expense") return spentForm(t);
    if (c && c.type === "income") return gotPaidForm(t);
    if (d && c && (d.type === "asset" || d.type === "liability") && (c.type === "asset" || c.type === "liability")) return moveForm(t);
    return txnForm(t); // equity/opening and anything unusual: the full form
  }

  /* CSV export — opens cleanly in Excel/Sheets or real accounting software.
     The ﻿ byte-order mark makes Excel read the UTF-8 correctly. */
  function exportCsv() {
    if (!OD.db.txns.length) {
      OD.ui.toast("Nothing to export yet.", true);
      return;
    }
    function cell(v) { return '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"'; }
    var rows = [["Date", "Description", "Debit account", "Credit account", "Amount"].map(cell).join(",")];
    OD.db.txns
      .slice()
      .sort(function (a, b) { return a.date < b.date ? -1 : 1; })
      .forEach(function (t) {
        rows.push([t.date, t.desc, OD.query.accountName(t.debit), OD.query.accountName(t.credit), t.amount.toFixed(2)].map(cell).join(","));
      });
    var blob = new Blob(["﻿" + rows.join("\r\n")], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "opsdesk-ledger-" + OD.todayISO() + ".csv";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    OD.ui.toast("Ledger exported — " + OD.db.txns.length + " transactions.");
  }

  OD.views.ledger = {
    title: "Ledger",
    actions: function () {
      if (OD.isSimple()) {
        return [
          { label: "Export CSV", onClick: exportCsv },
          { label: "+ Account", onClick: function () { accountForm(null); } },
          { label: "+ Add", primary: true, onClick: addChooser }
        ];
      }
      return [
        { label: "Export CSV", onClick: exportCsv },
        { label: "+ Account", onClick: function () { accountForm(null); } },
        { label: "+ Transaction", primary: true, onClick: function () { txnForm(null); } }
      ];
    },

    render: function (el) {
      var db = OD.db;
      var curKey = OD.lastMonths(1)[0];
      var flows = OD.query.monthFlows(curKey);

      var html = '<div class="tiles">' +
        '<div class="tile"><div class="tile-label">Income — ' + esc(OD.fmt.monthLabel(curKey)) + '</div><div class="tile-value">' + esc(OD.fmt.moneyCompact(flows.income)) + "</div></div>" +
        '<div class="tile"><div class="tile-label">Expenses — ' + esc(OD.fmt.monthLabel(curKey)) + '</div><div class="tile-value">' + esc(OD.fmt.moneyCompact(flows.expense)) + "</div></div>" +
        '<div class="tile"><div class="tile-label">Net — ' + esc(OD.fmt.monthLabel(curKey)) + '</div><div class="tile-value">' + esc(OD.fmt.moneyCompact(flows.net)) + "</div>" +
        '<div class="tile-delta ' + (flows.net >= 0 ? "up" : "down") + '">' + (flows.net >= 0 ? "in the black" : "in the red") + "</div></div>" +
        '<div class="tile"><div class="tile-label">Transactions on file</div><div class="tile-value">' + db.txns.length + "</div></div>" +
        "</div>";

      /* accounts by type */
      var accRows = db.accounts
        .slice()
        .sort(function (a, b) {
          var d = TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type);
          return d !== 0 ? d : a.name.localeCompare(b.name);
        })
        .map(function (a) {
          var bal = OD.query.accountBalance(a.id);
          var typeWord = a.type;
          if (OD.isSimple()) {
            typeWord = { asset: "I have", liability: "I owe", income: "income", expense: "category", equity: "starting" }[a.type] || a.type;
          }
          return '<tr class="clickable" data-account="' + a.id + '"><td><b>' + esc(a.name) + "</b></td>" +
            "<td>" + OD.ui.badge(typeWord, "plain") + "</td>" +
            '<td class="num' + (bal < 0 ? '" style="color:var(--critical)' : "") + '">' + esc(OD.fmt.money(bal)) + "</td></tr>";
        }).join("");

      /* trial balance */
      var totalDr = 0, totalCr = 0;
      var tbRows = db.accounts.map(function (a) {
        var raw = 0;
        db.txns.forEach(function (t) {
          if (t.debit === a.id) raw += t.amount;
          if (t.credit === a.id) raw -= t.amount;
        });
        var dr = raw > 0 ? raw : 0;
        var cr = raw < 0 ? -raw : 0;
        totalDr += dr; totalCr += cr;
        if (!dr && !cr) return "";
        return "<tr><td>" + esc(a.name) + '</td><td class="num">' + (dr ? esc(OD.fmt.money(dr)) : "") +
          '</td><td class="num">' + (cr ? esc(OD.fmt.money(cr)) : "") + "</td></tr>";
      }).join("");
      var balanced = Math.abs(totalDr - totalCr) < 0.005;
      tbRows += '<tr><td><b>Total</b></td><td class="num"><b>' + esc(OD.fmt.money(totalDr)) + '</b></td><td class="num"><b>' + esc(OD.fmt.money(totalCr)) + "</b></td></tr>";

      var secondCard;
      if (OD.isSimple()) {
        // spending by category this month — the question normal people actually ask
        var catRows = db.accounts
          .filter(function (a) { return a.type === "expense"; })
          .map(function (a) {
            var total = 0;
            db.txns.forEach(function (t) {
              if (t.debit === a.id && OD.monthKey(t.date) === curKey) total += t.amount;
            });
            return { label: a.name, value: total };
          })
          .filter(function (r) { return r.value > 0; })
          .sort(function (x, y) { return y.value - x.value; })
          .slice(0, 6);
        secondCard = '<div class="card"><div class="card-title">Where it went — ' + esc(OD.fmt.monthLabel(curKey)) + "</div>" +
          (catRows.length ? OD.charts.hbars(catRows, OD.fmt.moneyCompact)
            : '<div class="empty">Add some spending and your top categories show up here.</div>') +
          "</div>";
      } else {
        secondCard = '<div class="card"><div class="card-title">Trial balance ' +
          '<span class="right">' + (db.txns.length ? OD.ui.badge(balanced ? "balanced" : "out of balance", balanced ? "good" : "critical") : "") + "</span></div>" +
          OD.ui.table(["Account", { label: "Debit", cls: "num" }, { label: "Credit", cls: "num" }], db.txns.length ? tbRows : "", "Post a transaction and the proof appears.") +
          "</div>";
      }

      html += '<div class="grid grid-2 section-gap">' +
        '<div class="card"><div class="card-title">' + (OD.isSimple() ? "Accounts & categories" : "Accounts") + ' <span class="right hint">click to edit</span></div>' +
        OD.ui.table([OD.isSimple() ? "Name" : "Account", "Type", { label: "Balance", cls: "num" }], accRows, "Add accounts to start the books.") + "</div>" +
        secondCard + "</div>";

      /* transactions */
      var monthKeys = [];
      db.txns.forEach(function (t) {
        var k = OD.monthKey(t.date);
        if (monthKeys.indexOf(k) === -1) monthKeys.push(k);
      });
      monthKeys.sort().reverse();

      var txns = db.txns
        .filter(function (t) { return filterMonth === "all" || OD.monthKey(t.date) === filterMonth; })
        .filter(function (t) { return filterAccount === "all" || t.debit === filterAccount || t.credit === filterAccount; })
        .slice()
        .sort(function (a, b) { return a.date < b.date ? 1 : -1; });

      var txnRows = txns.map(function (t) {
        return '<tr class="clickable" data-txn="' + t.id + '">' +
          '<td class="fade">' + esc(OD.fmt.date(t.date)) + "</td>" +
          "<td><b>" + esc(t.desc) + "</b></td>" +
          "<td>" + esc(OD.query.accountName(t.debit)) + "</td>" +
          "<td>" + esc(OD.query.accountName(t.credit)) + "</td>" +
          '<td class="num">' + esc(OD.fmt.money(t.amount)) + "</td></tr>";
      }).join("");

      html += '<div class="card section-gap"><div class="card-title">Transactions</div>' +
        '<div class="filters">' +
        '<select class="control" id="ledger-month"><option value="all">All months</option>' +
        monthKeys.map(function (k) {
          return '<option value="' + k + '"' + (filterMonth === k ? " selected" : "") + ">" + OD.fmt.monthLabel(k) + " " + k.slice(0, 4) + "</option>";
        }).join("") + "</select>" +
        '<select class="control" id="ledger-account"><option value="all">All accounts</option>' +
        db.accounts.map(function (a) {
          return '<option value="' + a.id + '"' + (filterAccount === a.id ? " selected" : "") + ">" + esc(a.name) + "</option>";
        }).join("") + "</select>" +
        "</div>" +
        OD.ui.table(
          OD.isSimple()
            ? ["Date", "Description", "Where it went", "Where it came from", { label: "Amount", cls: "num" }]
            : ["Date", "Description", "Debit", "Credit", { label: "Amount", cls: "num" }],
          txnRows,
          db.txns.length ? "Nothing matches that filter." : (OD.isSimple() ? "Press + Add to record your first one." : "No transactions yet.")) +
        "</div>";

      el.innerHTML = html;

      /* wiring */
      el.querySelectorAll("[data-account]").forEach(function (r) {
        r.addEventListener("click", function () {
          accountForm(db.accounts.find(function (a) { return a.id === r.getAttribute("data-account"); }));
        });
      });
      el.querySelectorAll("[data-txn]").forEach(function (r) {
        r.addEventListener("click", function () {
          var t = db.txns.find(function (x) { return x.id === r.getAttribute("data-txn"); });
          if (OD.isSimple()) openSimpleTxn(t);
          else txnForm(t);
        });
      });
      el.querySelector("#ledger-month").addEventListener("change", function (e) {
        filterMonth = e.target.value;
        OD.app.refresh();
      });
      el.querySelector("#ledger-account").addEventListener("change", function (e) {
        filterAccount = e.target.value;
        OD.app.refresh();
      });
    }
  };

  /* command-palette hooks */
  OD.views.ledger.newTxn = function () {
    if (OD.isSimple()) addChooser();
    else txnForm(null);
  };
  OD.views.ledger.openAccount = function (id) {
    var a = OD.db.accounts.find(function (x) { return x.id === id; });
    if (a) accountForm(a);
  };
  OD.views.ledger.openTxn = function (id) {
    var t = OD.db.txns.find(function (x) { return x.id === id; });
    if (t) txnForm(t);
  };
})();
