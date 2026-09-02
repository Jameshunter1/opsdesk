/* OpsDesk — Lab: zones, VM fleet, and the firewall policy matrix.
   The matrix mirrors how pfSense thinks: who may START a conversation.
   Design first, build second — every rule carries a one-sentence reason. */
(function () {
  "use strict";

  var esc = function (s) { return OD.ui.esc(s); };

  var VM_TONES = { running: "good", stopped: "plain", template: "accent", planned: "warning" };

  function zoneOptions() {
    var names = OD.db.zones.map(function (z) { return z.name; });
    return ["—", "multi"].concat(names);
  }

  function policyZones() {
    // WAN is where the internet comes from, not a place rules originate.
    return OD.db.zones.map(function (z) { return z.name; }).filter(function (n) { return n !== "WAN"; });
  }

  /* ---------- forms ---------- */

  function vmForm(vm) {
    OD.ui.form({
      title: vm ? "Edit VM — " + vm.name : "New VM",
      values: vm,
      fields: [
        { key: "name", label: "Name", required: true, placeholder: "svc01" },
        { key: "os", label: "Operating system", placeholder: "Debian 13" },
        { key: "zone", label: "Zone", type: "select", options: zoneOptions() },
        { key: "ip", label: "IP address", placeholder: "10.20.20.20" },
        { key: "ram", label: "RAM (GB)", type: "number", step: "0.5" },
        { key: "vcpu", label: "vCPU", type: "number" },
        { key: "disk", label: "Disk (GB)", type: "number" },
        { key: "status", label: "Status", type: "select", options: OD.enums.vmStatus },
        { key: "role", label: "Role", span2: true, placeholder: "What this machine is for" },
        { key: "notes", label: "Notes", type: "textarea", span2: true }
      ],
      onSubmit: function (v) {
        if (vm) Object.assign(vm, v);
        else { v.id = OD.uid(); OD.db.vms.push(v); }
        OD.store.save();
        OD.app.refresh();
        OD.ui.toast(vm ? "VM updated." : "VM added.");
      },
      onDelete: vm && function () {
        OD.ui.confirm({ title: "Delete VM?", message: 'Remove "' + vm.name + '" from the fleet. This only deletes the record, not any real VM.' }, function () {
          OD.db.vms = OD.db.vms.filter(function (x) { return x.id !== vm.id; });
          OD.store.save();
          OD.app.refresh();
          OD.ui.toast("VM deleted.");
        });
      }
    });
  }

  function zoneForm(zone) {
    OD.ui.form({
      title: zone ? "Edit zone — " + zone.name : "New zone",
      values: zone,
      fields: [
        { key: "name", label: "Zone name", required: true, placeholder: "DMZ" },
        { key: "iface", label: "Interface", placeholder: "em3" },
        { key: "subnet", label: "Subnet", placeholder: "10.20.30.0/24" },
        { key: "gateway", label: "Gateway", placeholder: "10.20.30.1" },
        { key: "dhcp", label: "DHCP range", placeholder: ".100–.200" }
      ],
      onSubmit: function (v) {
        if (zone) Object.assign(zone, v);
        else { v.id = OD.uid(); OD.db.zones.push(v); }
        OD.store.save();
        OD.app.refresh();
        OD.ui.toast(zone ? "Zone updated." : "Zone added.");
      },
      onDelete: zone && function () {
        OD.ui.confirm({ title: "Delete zone?", message: 'Remove "' + zone.name + '" and any firewall rules that touch it.' }, function () {
          OD.db.zones = OD.db.zones.filter(function (x) { return x.id !== zone.id; });
          OD.db.rules = OD.db.rules.filter(function (r) { return r.from !== zone.name && r.to !== zone.name; });
          OD.store.save();
          OD.app.refresh();
          OD.ui.toast("Zone deleted.");
        });
      }
    });
  }

  function ruleForm(from, to) {
    var rule = OD.db.rules.find(function (r) { return r.from === from && r.to === to; });
    OD.ui.form({
      title: "Rule — " + from + " → " + to,
      values: rule || { action: "block" },
      fields: [
        { key: "action", label: "Action", type: "select", options: OD.enums.fwActions, required: true },
        { key: "ports", label: "Ports (for limited)", placeholder: "80, 443, 53" },
        {
          key: "reason", label: "Reason — one sentence", type: "textarea", span2: true, required: true,
          hint: "If you can't explain a rule in one sentence, it isn't designed yet."
        }
      ],
      onSubmit: function (v) {
        if (rule) Object.assign(rule, v);
        else OD.db.rules.push({ id: OD.uid(), from: from, to: to, action: v.action, ports: v.ports, reason: v.reason });
        OD.store.save();
        OD.app.refresh();
        OD.ui.toast("Rule saved.");
      },
      onDelete: rule && function () {
        OD.db.rules = OD.db.rules.filter(function (r) { return r.id !== rule.id; });
        OD.store.save();
        OD.app.refresh();
        OD.ui.toast("Rule cleared — cell falls back to default-deny.");
      }
    });
  }

  /* ---------- view ---------- */

  OD.views.lab = {
    title: "Lab",
    actions: function () {
      return [
        { label: "+ Zone", onClick: function () { zoneForm(null); } },
        { label: "+ VM", primary: true, onClick: function () { vmForm(null); } }
      ];
    },

    render: function (el) {
      var db = OD.db;

      var ramRunning = 0, ramAll = 0;
      db.vms.forEach(function (v) {
        var r = Number(v.ram) || 0;
        if (v.status === "running") ramRunning += r;
        if (v.status !== "template") ramAll += r;
      });

      var html = '<div class="tiles">' +
        '<div class="tile"><div class="tile-label">RAM committed (running)</div><div class="tile-value">' + ramRunning + ' <small>GB</small></div>' +
        '<div class="tile-delta">' + ramAll + " GB if the whole fleet ran — run only what the module needs</div></div>" +
        '<div class="tile"><div class="tile-label">Machines</div><div class="tile-value">' +
        db.vms.filter(function (v) { return v.status !== "template"; }).length +
        ' <small>+ ' + db.vms.filter(function (v) { return v.status === "template"; }).length + " templates</small></div></div>" +
        '<div class="tile"><div class="tile-label">Network zones</div><div class="tile-value">' + db.zones.length + "</div></div>" +
        '<div class="tile"><div class="tile-label">Firewall rules designed</div><div class="tile-value">' + db.rules.length + "</div></div>" +
        "</div>";

      /* zones */
      var zoneRows = db.zones.map(function (z) {
        return '<tr class="clickable" data-zone="' + z.id + '"><td><b>' + esc(z.name) + "</b></td>" +
          '<td class="mono">' + esc(z.iface) + '</td><td class="mono">' + esc(z.subnet) + "</td>" +
          '<td class="mono">' + esc(z.gateway) + '</td><td class="mono">' + esc(z.dhcp) + "</td></tr>";
      }).join("");

      html += '<div class="card section-gap"><div class="card-title">Network zones</div>' +
        OD.ui.table(["Zone", "Interface", "Subnet", "Gateway", "DHCP"], zoneRows, "Add your first zone — LAN is a good start.") + "</div>";

      /* VM fleet */
      var vmRows = db.vms.map(function (v) {
        return '<tr class="clickable" data-vm="' + v.id + '">' +
          '<td class="mono"><b>' + esc(v.name) + "</b></td>" +
          "<td>" + esc(v.os) + "</td>" +
          "<td>" + esc(v.zone) + "</td>" +
          '<td class="mono">' + esc(v.ip || "—") + "</td>" +
          '<td class="num">' + esc(v.ram) + "</td>" +
          '<td class="num">' + esc(v.vcpu) + "</td>" +
          '<td class="num">' + esc(v.disk) + "</td>" +
          "<td>" + OD.ui.badge(v.status, VM_TONES[v.status] || "plain") + "</td>" +
          '<td class="fade">' + esc(v.role) + "</td></tr>";
      }).join("");

      html += '<div class="card section-gap"><div class="card-title">VM fleet <span class="right hint">click a row to edit</span></div>' +
        OD.ui.table(
          ["Name", "OS", "Zone", "IP", { label: "RAM", cls: "num" }, { label: "vCPU", cls: "num" }, { label: "Disk", cls: "num" }, "Status", "Role"],
          vmRows, "No machines yet. Add the firewall first — everything else hangs off it."
        ) + "</div>";

      /* firewall matrix */
      var zs = policyZones();
      var tos = zs.concat(["Internet"]);
      var matrix = "";
      if (zs.length) {
        matrix = '<div class="table-wrap"><table class="fw-matrix"><tr><th>From \\ To</th>';
        tos.forEach(function (t) { matrix += "<th>" + esc(t) + "</th>"; });
        matrix += "</tr>";
        zs.forEach(function (f) {
          matrix += "<tr><th>" + esc(f) + "</th>";
          tos.forEach(function (t) {
            if (t === f) { matrix += '<td class="fw-self">—</td>'; return; }
            var rule = db.rules.find(function (r) { return r.from === f && r.to === t; });
            if (!rule) {
              matrix += '<td class="fw-cell" data-from="' + esc(f) + '" data-to="' + esc(t) + '" title="No rule designed — implicit default-deny">' +
                '<span class="fw-action" style="color:var(--muted)">unset</span></td>';
            } else {
              var label = rule.action === "limited" ? "limited" : rule.action;
              matrix += '<td class="fw-cell fw-' + rule.action + '" data-from="' + esc(f) + '" data-to="' + esc(t) +
                '" title="' + esc(rule.reason) + '"><span class="fw-action">' + esc(label) + "</span>" +
                (rule.ports ? '<div class="fw-ports">' + esc(rule.ports) + "</div>" : "") + "</td>";
            }
          });
          matrix += "</tr>";
        });
        matrix += "</table></div>" +
          '<p class="hint" style="margin-top:10px">Click a cell to design a rule. Hover shows its one-sentence reason. ' +
          "Traffic is stateful — rules only decide who may <i>start</i> a conversation; replies come back on their own.</p>";
      } else {
        matrix = '<div class="empty">Add zones above and the policy matrix appears here.</div>';
      }

      html += '<div class="card section-gap"><div class="card-title">Firewall policy matrix</div>' + matrix + "</div>";

      el.innerHTML = html;

      /* wiring */
      el.querySelectorAll("[data-vm]").forEach(function (r) {
        r.addEventListener("click", function () {
          vmForm(db.vms.find(function (v) { return v.id === r.getAttribute("data-vm"); }));
        });
      });
      el.querySelectorAll("[data-zone]").forEach(function (r) {
        r.addEventListener("click", function () {
          zoneForm(db.zones.find(function (z) { return z.id === r.getAttribute("data-zone"); }));
        });
      });
      el.querySelectorAll(".fw-cell").forEach(function (c) {
        c.addEventListener("click", function () {
          ruleForm(c.getAttribute("data-from"), c.getAttribute("data-to"));
        });
      });
    }
  };
})();
