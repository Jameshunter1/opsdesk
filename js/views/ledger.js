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

  function accountForm(a) {
    OD.ui.form({
      title: a ? "Edit account — " + a.name : "New account",
      values: a,
      fields: [
        { key: "name", label: "Account name", required: true, placeholder: "Chequing" },
        {
          key: "type", label: "Type", type: "select", options: OD.enums.accountTypes, required: true,
          hint: "Assets and expenses grow with debits; the other three grow with credits."
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

  OD.views.ledger = {
    title: "Ledger",
    actions: function () {
      return [
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
          return '<tr class="clickable" data-account="' + a.id + '"><td><b>' + esc(a.name) + "</b></td>" +
            "<td>" + OD.ui.badge(a.type, "plain") + "</td>" +
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

      html += '<div class="grid grid-2 section-gap">' +
        '<div class="card"><div class="card-title">Accounts <span class="right hint">click to edit</span></div>' +
        OD.ui.table(["Account", "Type", { label: "Balance", cls: "num" }], accRows, "Add accounts to start the books.") + "</div>" +
        '<div class="card"><div class="card-title">Trial balance ' +
        '<span class="right">' + (db.txns.length ? OD.ui.badge(balanced ? "balanced" : "out of balance", balanced ? "good" : "critical") : "") + "</span></div>" +
        OD.ui.table(["Account", { label: "Debit", cls: "num" }, { label: "Credit", cls: "num" }], db.txns.length ? tbRows : "", "Post a transaction and the proof appears.") +
        "</div></div>";

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
        OD.ui.table(["Date", "Description", "Debit", "Credit", { label: "Amount", cls: "num" }], txnRows,
          db.txns.length ? "Nothing matches that filter." : "No transactions yet.") +
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
          txnForm(db.txns.find(function (t) { return t.id === r.getAttribute("data-txn"); }));
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
})();
