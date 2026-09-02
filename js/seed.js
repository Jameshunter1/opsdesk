/* OpsDesk — demo data.
   Modeled on a real VirtualBox + pfSense homelab so the app makes sense the
   first time it opens. Employers, amounts, and dates are sample data.
   Dates are generated relative to "today" so the demo never looks stale. */
(function () {
  "use strict";

  function daysAgo(n) {
    var d = new Date();
    d.setDate(d.getDate() - n);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  OD.seed = function () {
    var id = OD.uid;
    var months = OD.lastMonths(6); // oldest → current

    /* ---------- accounts ---------- */
    var acc = {
      chequing: { id: id(), name: "Chequing", type: "asset" },
      cash:     { id: id(), name: "Cash", type: "asset" },
      visa:     { id: id(), name: "Visa", type: "liability" },
      opening:  { id: id(), name: "Opening balance", type: "equity" },
      pay:      { id: id(), name: "Pay — support job", type: "income" },
      rent:     { id: id(), name: "Rent", type: "expense" },
      groceries:{ id: id(), name: "Groceries", type: "expense" },
      car:      { id: id(), name: "Car & gas", type: "expense" },
      lab:      { id: id(), name: "Lab & hardware", type: "expense" },
      certs:    { id: id(), name: "Certs & courses", type: "expense" }
    };

    var txns = [];
    function txn(date, desc, amount, debit, credit) {
      txns.push({ id: id(), date: date, desc: desc, amount: amount, debit: debit.id, credit: credit.id });
    }

    txn(months[0] + "-01", "Opening balance", 3200, acc.chequing, acc.opening);

    // five completed months of routine cash flow
    for (var i = 0; i < 5; i++) {
      var m = months[i];
      txn(m + "-05", "Payday", 1350, acc.chequing, acc.pay);
      txn(m + "-19", "Payday", 1350, acc.chequing, acc.pay);
      txn(m + "-01", "Rent", 950, acc.rent, acc.chequing);
      txn(m + "-08", "Groceries", 175 + i * 9, acc.groceries, acc.chequing);
      txn(m + "-22", "Groceries", 168 + i * 7, acc.groceries, acc.chequing);
      txn(m + "-12", "Gas", 105 + i * 6, acc.car, acc.chequing);
    }
    // lab & study spending, the fun part
    txn(months[1] + "-14", "16 GB RAM upgrade (used)", 89, acc.lab, acc.visa);
    txn(months[2] + "-03", "TP-Link 8-port gigabit switch", 46, acc.lab, acc.visa);
    txn(months[2] + "-27", "Visa payment", 135, acc.visa, acc.chequing);
    txn(months[3] + "-09", "Practice exam bundle (Network+)", 39, acc.certs, acc.visa);
    txn(months[4] + "-16", "CompTIA Network+ exam voucher", 481, acc.certs, acc.chequing);
    txn(months[4] + "-20", "ATM withdrawal", 60, acc.cash, acc.chequing);
    txn(months[4] + "-21", "Cat6 patch cables + keystone jacks", 32, acc.lab, acc.cash);
    // current month has just started
    txn(months[5] + "-01", "Rent", 950, acc.rent, acc.chequing);

    /* ---------- lab: zones ---------- */
    var zones = [
      { id: id(), name: "WAN", iface: "em0", subnet: "from VirtualBox NAT", gateway: "—", dhcp: "receives" },
      { id: id(), name: "LAN", iface: "em1", subnet: "10.20.10.0/24", gateway: "10.20.10.1", dhcp: ".100–.200" },
      { id: id(), name: "SRV", iface: "em2", subnet: "10.20.20.0/24", gateway: "10.20.20.1", dhcp: ".100–.200" },
      { id: id(), name: "DMZ", iface: "em3", subnet: "10.20.30.0/24", gateway: "10.20.30.1", dhcp: ".100–.200" }
    ];

    /* ---------- lab: VMs ---------- */
    var vms = [
      { name: "pfsense", os: "pfSense CE 2.9 (FreeBSD)", zone: "multi", ip: "10.20.10.1", ram: 2, vcpu: 1, disk: 20, status: "running", role: "Core firewall/router — 4 NICs, one per zone" },
      { name: "debian-golden", os: "Debian 13", zone: "—", ip: "", ram: 1, vcpu: 1, disk: 40, status: "template", role: "Golden server image — cloned, never run in the lab" },
      { name: "client-golden", os: "Debian 13 + Xfce", zone: "—", ip: "", ram: 3, vcpu: 2, disk: 40, status: "template", role: "Golden GUI client image" },
      { name: "client01", os: "Debian 13 + Xfce", zone: "LAN", ip: "10.20.10.101", ram: 3, vcpu: 2, disk: 40, status: "running", role: "Daily driver for firewall pages and browser tests" },
      { name: "dc01", os: "Windows Server 2025 (eval)", zone: "SRV", ip: "10.20.20.10", ram: 4, vcpu: 2, disk: 60, status: "planned", role: "Domain controller: AD DS, DNS, DHCP" },
      { name: "win11", os: "Windows 11 Enterprise (eval)", zone: "LAN", ip: "", ram: 4, vcpu: 2, disk: 80, status: "planned", role: "Domain-joined workstation (EFI + TPM 2.0 before first boot)" },
      { name: "svc01", os: "Debian 13", zone: "SRV", ip: "10.20.20.20", ram: 1, vcpu: 1, disk: 40, status: "planned", role: "General services host" },
      { name: "wazuh01", os: "Debian 13", zone: "SRV", ip: "10.20.20.30", ram: 6, vcpu: 2, disk: 40, status: "planned", role: "Wazuh SIEM" },
      { name: "mon01", os: "Debian 13", zone: "SRV", ip: "10.20.20.40", ram: 2, vcpu: 1, disk: 40, status: "planned", role: "Monitoring stack" },
      { name: "frr01", os: "Debian 13", zone: "SRV", ip: "10.20.20.50", ram: 1, vcpu: 1, disk: 40, status: "planned", role: "FRR routing lab" }
    ].map(function (v) { v.id = id(); v.notes = ""; return v; });

    /* ---------- lab: firewall policy (one sentence of reasoning per rule) ---------- */
    var rules = [
      { from: "LAN", to: "SRV", action: "allow", ports: "", reason: "My workstation zone manages the servers." },
      { from: "LAN", to: "DMZ", action: "allow", ports: "", reason: "I need to reach exposed services to test and administer them." },
      { from: "LAN", to: "Internet", action: "allow", ports: "", reason: "Trusted clients browse freely." },
      { from: "SRV", to: "LAN", action: "block", ports: "", reason: "Servers never initiate into the client zone; log it because it would mean compromise." },
      { from: "SRV", to: "DMZ", action: "block", ports: "", reason: "Internal servers have no business starting conversations with exposed hosts." },
      { from: "SRV", to: "Internet", action: "limited", ports: "80, 443, 53", reason: "Updates and DNS only — a server fetching anything else is suspicious." },
      { from: "DMZ", to: "LAN", action: "block", ports: "", reason: "The whole point of a DMZ: a popped web host can't pivot to my clients. Log it." },
      { from: "DMZ", to: "SRV", action: "block", ports: "", reason: "Exposed hosts stay sealed off from internal services." },
      { from: "DMZ", to: "Internet", action: "block", ports: "", reason: "Nothing in the DMZ needs outbound; blocking kills reverse shells and exfil." }
    ].map(function (r) { r.id = id(); return r; });

    /* ---------- desk: tickets ---------- */
    var tickets = [
      {
        num: "T-0001", title: "pfSense VM built as “Other/Unknown” — wrong defaults everywhere",
        type: "incident", area: "virtualization", priority: "high", status: "resolved",
        opened: daysAgo(21), resolved: daysAgo(20),
        symptom: "New pfSense VM got a 200 MB disk and a 1990s network card; later boots failed in two different ways.",
        cause: "The VirtualBox OS-type field drives every default the hypervisor picks. One wrong field fanned out into four separate failures.",
        fix: "Set OS type to FreeBSD (64-bit), rebuilt with a 20 GB disk and four Intel PRO/1000 adapters.",
        lesson: "OS type is not cosmetic. When one root cause is found, check everything else it touched instead of fixing one symptom per boot."
      },
      {
        num: "T-0002", title: "“CPU doesn't support long mode” booting pfSense",
        type: "incident", area: "virtualization", priority: "high", status: "resolved",
        opened: daysAgo(20), resolved: daysAgo(20),
        symptom: "64-bit pfSense installer refused to boot; error implied the CPU was 32-bit.",
        cause: "The VM still carried a 32-bit profile from the Other/Unknown mistake, hiding the real CPU's 64-bit mode.",
        fix: "OS type → FreeBSD (64-bit). The real CPU was fine; the VM settings were lying about it.",
        lesson: "In a wall of boot text the answer is the last decisive error line, not the first scary one."
      },
      {
        num: "T-0003", title: "Kernel panic: “requires a local APIC”",
        type: "incident", area: "virtualization", priority: "medium", status: "resolved",
        opened: daysAgo(19), resolved: daysAgo(19),
        symptom: "pfSense boot stopped at a db> debugger prompt.",
        cause: "I/O APIC was disabled — a leftover from the 32-bit profile. Changing OS type doesn't fix hardware settings that already exist.",
        fix: "System → Motherboard → Enable I/O APIC.",
        lesson: "The panic: line IS the diagnosis."
      },
      {
        num: "T-0004", title: "ifup: unknown interface enp0s8 on fresh clone",
        type: "incident", area: "linux", priority: "medium", status: "resolved",
        opened: daysAgo(14), resolved: daysAgo(14),
        symptom: "Second NIC refused to come up on a new linked clone; error read like the card didn't exist.",
        cause: "Typed /n instead of \\n while echoing the config, so the interfaces file was one broken line. The error means “no config with that name,” not “no such card.”",
        fix: "Rewrote /etc/network/interfaces.d/enp0s8 in nano, verified with cat, then ifup brought it up with a 192.168.56.x lease.",
        lesson: "Always cat a file you generated before trusting it."
      },
      {
        num: "T-0005", title: "Enable DHCP on SRV and DMZ interfaces",
        type: "task", area: "network", priority: "medium", status: "in-progress",
        opened: daysAgo(3), resolved: "",
        symptom: "", cause: "",
        fix: "Interfaces → Assignments → add em2/em3, static gateway IPs, then Services → DHCP Server with .100–.200 scopes.",
        lesson: ""
      },
      {
        num: "T-0006", title: "First packet capture — label the 4 DORA packets",
        type: "task", area: "network", priority: "low", status: "open",
        opened: daysAgo(1), resolved: "",
        symptom: "", cause: "",
        fix: "Capture a DHCP renew on LAN, open in Wireshark, label Discover/Offer/Request/Ack.",
        lesson: ""
      }
    ].map(function (t) { t.id = id(); return t; });

    /* ---------- pipeline: job applications (sample employers) ---------- */
    var jobs = [
      {
        company: "Lakeshore Credit Union", role: "Service Desk Analyst", source: "Indeed",
        url: "", resume: "IT resume v12", salary: "CAD 26/hr", status: "interview", applied: daysAgo(12),
        notes: "Financial-software support background is a direct match.",
        activity: [
          { date: daysAgo(12), note: "Applied with IT resume v12." },
          { date: daysAgo(6), note: "Phone screen — asked about ticket volumes and escalation." },
          { date: daysAgo(2), note: "In-person interview booked for next week. Review AD + M365 admin basics." }
        ]
      },
      {
        company: "Seaway Manufacturing", role: "IT Support Technician", source: "Indeed",
        url: "", resume: "IT resume v12", salary: "", status: "applied", applied: daysAgo(8),
        notes: "Shop-floor environment; shift coverage is a selling point.",
        activity: [{ date: daysAgo(8), note: "Applied online." }]
      },
      {
        company: "Vine & Vale Logistics", role: "Junior Network Administrator", source: "LinkedIn",
        url: "", resume: "IT resume v11", salary: "CAD 55k", status: "screening", applied: daysAgo(15),
        notes: "Posting mentions pfSense and VLANs — lead with the homelab.",
        activity: [
          { date: daysAgo(15), note: "Applied." },
          { date: daysAgo(5), note: "Recruiter reply — screening call scheduled." }
        ]
      },
      {
        company: "Harbourview Accounting", role: "Accounts Payable Clerk", source: "Indeed",
        url: "", resume: "Accounting resume", salary: "CAD 25/hr", status: "applied", applied: daysAgo(6),
        notes: "Keeps the accounting track alive alongside IT applications.",
        activity: [{ date: daysAgo(6), note: "Applied with accounting resume." }]
      },
      {
        company: "Brockway College", role: "Helpdesk Technician (Tier 1)", source: "College board",
        url: "", resume: "IT resume v12", salary: "", status: "saved", applied: "",
        notes: "Posting closes soon — tailor the cover letter to student-facing support.",
        activity: []
      },
      {
        company: "Cataract Utilities", role: "NOC Technician (nights)", source: "Indeed",
        url: "", resume: "IT resume v11", salary: "", status: "rejected", applied: daysAgo(25),
        notes: "Wanted 2 years NOC experience.",
        activity: [
          { date: daysAgo(25), note: "Applied." },
          { date: daysAgo(16), note: "Rejection email — keep an eye out for their junior postings." }
        ]
      }
    ].map(function (j) { j.id = id(); return j; });

    /* ---------- study ---------- */
    var modules = [
      { name: "Module 0 — Lab foundation", status: "done", hours: 14, topics: "VirtualBox, golden images, linked clones, snapshots, SSH", proof: "Fresh clone to SSH prompt, timed." },
      { name: "Module 1 — Network core: pfSense", status: "active", hours: 9, topics: "Zones, DHCP, default-deny rules, aliases, packet capture", proof: "LAN client leases, resolves, and browses through my firewall." },
      { name: "Module 2 — TLS & internal CA", status: "todo", hours: 0, topics: "Internal certificate authority, trusting the firewall GUI properly", proof: "" },
      { name: "Module 3 — Routing with FRR", status: "todo", hours: 0, topics: "OSPF between lab routers, branch site simulation", proof: "" },
      { name: "Module 4 — Active Directory domain", status: "todo", hours: 0, topics: "AD DS, DNS, DHCP on dc01; domain-join win11", proof: "" },
      { name: "Module 5 — Monitoring & SIEM", status: "todo", hours: 0, topics: "Wazuh agents, dashboards, alert triage", proof: "" }
    ].map(function (m) { m.id = id(); m.notes = ""; return m; });

    var certs = [
      { name: "CompTIA A+", status: "passed", date: "" },
      { name: "CompTIA Security+", status: "passed", date: "" },
      { name: "CompTIA Network+", status: "studying", date: "" },
      { name: "Cisco CCNA", status: "planned", date: "" }
    ].map(function (c) { c.id = id(); return c; });

    var commands = [
      { cmd: "ip a", what: "Show network cards and their addresses" },
      { cmd: "sudo ifup <iface>", what: "Bring a network card up from its config" },
      { cmd: "hostnamectl set-hostname <name>", what: "Rename the machine" },
      { cmd: "systemctl status ssh", what: "Is a service running" },
      { cmd: "journalctl -u ssh", what: "Why a service isn't running" },
      { cmd: "cat <file>", what: "Check a file's contents before trusting it" },
      { cmd: "ssh-keygen -R <ip>", what: "Forget an old server fingerprint (run on the client)" },
      { cmd: "Get-FileHash -Algorithm SHA256", what: "Verify a download (PowerShell)" }
    ].map(function (c) { c.id = id(); return c; });

    return {
      version: 1,
      settings: { name: "", theme: "auto", seeded: true, bannerDismissed: false },
      counters: { ticket: tickets.length },
      zones: zones,
      vms: vms,
      rules: rules,
      tickets: tickets,
      accounts: Object.keys(acc).map(function (k) { return acc[k]; }),
      txns: txns,
      jobs: jobs,
      modules: modules,
      certs: certs,
      commands: commands
    };
  };
})();
