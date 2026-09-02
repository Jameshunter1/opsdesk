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

    /* ---------- study: two plans, each with its own modules ---------- */
    var planLab = { id: id(), name: "Homelab curriculum", status: "active", examDate: "" };
    var planNet = { id: id(), name: "CompTIA Network+", status: "active", examDate: daysAgo(-42) };
    var plans = [planNet, planLab];

    var modules = [
      { name: "Module 0 — Lab foundation", status: "done", hours: 14, topics: "VirtualBox, golden images, linked clones, snapshots, SSH", proof: "Fresh clone to SSH prompt, timed." },
      { name: "Module 1 — Network core: pfSense", status: "active", hours: 9, topics: "Zones, DHCP, default-deny rules, aliases, packet capture", proof: "LAN client leases, resolves, and browses through my firewall." },
      { name: "Module 2 — TLS & internal CA", status: "todo", hours: 0, topics: "Internal certificate authority, trusting the firewall GUI properly", proof: "" },
      { name: "Module 3 — Routing with FRR", status: "todo", hours: 0, topics: "OSPF between lab routers, branch site simulation", proof: "" },
      { name: "Module 4 — Active Directory domain", status: "todo", hours: 0, topics: "AD DS, DNS, DHCP on dc01; domain-join win11", proof: "" },
      { name: "Module 5 — Monitoring & SIEM", status: "todo", hours: 0, topics: "Wazuh agents, dashboards, alert triage", proof: "" }
    ].map(function (m) { m.id = id(); m.notes = ""; m.planId = planLab.id; return m; });

    modules = modules.concat([
      { name: "Networking fundamentals & OSI", status: "done", hours: 12, topics: "Models, encapsulation, ports & protocols", proof: "90%+ on two practice quizzes" },
      { name: "Subnetting & IP addressing", status: "active", hours: 7, topics: "VLSM, CIDR, IPv6 basics", proof: "Solve 10 subnet problems under 10 minutes" },
      { name: "Routing, switching & wireless", status: "todo", hours: 0, topics: "OSPF vs static, VLANs, 802.11 standards", proof: "" },
      { name: "Practice exams week", status: "todo", hours: 0, topics: "Two full timed exams + review of misses", proof: "Both above passing score" }
    ].map(function (m) { m.id = id(); m.notes = ""; m.planId = planNet.id; return m; }));

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

    /* ---------- goals demo: fuel, training, study, projects ---------- */

    var supps = [
      { id: id(), name: "Multivitamin", dose: "1/day" },
      { id: id(), name: "Creatine", dose: "5 g" },
      { id: id(), name: "Vitamin D", dose: "1000 IU" }
    ];

    var fuelPlan = {
      kcal: 1990, protein: 150, fat: 55, carbs: 225,
      stats: { sex: "male", age: 26, heightCm: 178, weightKg: 82, activity: "1.375", goal: "cut" }
    };

    var fuelLogs = [];
    for (var fi = 1; fi <= 10; fi++) {
      if (fi === 3) continue; // a real week has a hole in it
      var lowDay = fi === 6;
      var allSupps = {};
      supps.forEach(function (s, si) { if (!(fi === 5 && si === 2)) allSupps[s.id] = true; });
      fuelLogs.push({
        id: id(), date: daysAgo(fi),
        protein: lowDay ? 104 : 142 + ((fi * 7) % 16),
        carbs: 205 + ((fi * 11) % 30),
        fat: 50 + ((fi * 3) % 9),
        note: "", supps: allSupps
      });
    }

    var routine = { days: { 0: "", 1: "Push", 2: "", 3: "Pull", 4: "", 5: "Legs", 6: "" } };

    var workouts = [];
    var LIFTS = {
      Push: [["Bench press", 3, 8], ["Overhead press", 3, 8], ["Incline DB press", 3, 10]],
      Pull: [["Barbell row", 3, 8], ["Lat pulldown", 3, 10], ["Face pull", 3, 12]],
      Legs: [["Squat", 3, 6], ["Romanian deadlift", 3, 8], ["Leg press", 3, 10]]
    };
    var BASE = { "Bench press": 135, "Overhead press": 85, "Incline DB press": 45, "Barbell row": 125, "Lat pulldown": 120, "Face pull": 40, "Squat": 185, "Romanian deadlift": 155, "Leg press": 270 };
    for (var wi = 20; wi >= 1; wi--) {
      var iso = daysAgo(wi);
      var wd = new Date(iso + "T12:00:00").getDay();
      var label = routine.days[wd];
      if (!label) continue;
      if (wi === 8) continue; // one missed session keeps it honest
      var week = wi > 7 ? 0 : 1; // small progression between weeks
      workouts.push({
        id: id(), date: iso, kind: "lift", label: label + " day", minutes: 0,
        entries: LIFTS[label].map(function (l) {
          return { exercise: l[0], sets: l[1], reps: l[2], weight: BASE[l[0]] + week * 5 };
        }),
        notes: ""
      });
    }
    workouts.push({ id: id(), date: daysAgo(2), kind: "cardio", label: "Walk", minutes: 40, entries: [], notes: "Podcast + sunshine" });

    var weighins = [];
    for (var wk = 8; wk >= 0; wk--) {
      weighins.push({ id: id(), date: daysAgo(wk * 7), weightKg: Math.round((82 + wk * 0.28 + (wk % 2 ? 0.15 : -0.1)) * 10) / 10 });
    }

    var habits = [
      { id: id(), name: "Steps / daily walk" },
      { id: id(), name: "In bed on time" },
      { id: id(), name: "Enough water" }
    ];
    var habitChecks = {};
    for (var hd = 1; hd <= 12; hd++) {
      var hIso = daysAgo(hd);
      habitChecks[hIso] = {};
      habits.forEach(function (h, hx) {
        var miss = (hd === 2 && hx === 1) || (hd === 5 && hx === 2) || (hd === 7 && hx !== 2);
        if (!miss) habitChecks[hIso][h.id] = true;
      });
    }

    var studyPlan = { target: 30 };
    var studyLogs = [];
    var TOPICS = ["Subnetting drills", "OSI layers review", "Ports & protocols flashcards", "Practice exam block", "Wireless standards", "Routing concepts"];
    for (var si2 = 1; si2 <= 12; si2++) {
      if (si2 === 4 || si2 === 9) continue;
      studyLogs.push({ id: id(), date: daysAgo(si2), minutes: 25 + ((si2 * 9) % 26), what: TOPICS[si2 % TOPICS.length], planId: planNet.id });
    }

    var projects = [
      {
        id: id(), name: "Homelab — Module 4: AD domain", why: "dc01 + a joined win11 box is resume gold", status: "active", due: "",
        tasks: [
          { id: id(), text: "Install Windows Server 2025 on dc01", done: true, doneDate: daysAgo(6) },
          { id: id(), text: "Promote to domain controller (AD DS + DNS)", done: true, doneDate: daysAgo(4) },
          { id: id(), text: "Move DHCP from pfSense scope plan", done: false, doneDate: "" },
          { id: id(), text: "Build win11 with EFI + TPM before first boot", done: false, doneDate: "" },
          { id: id(), text: "Domain-join win11 and apply first GPO", done: false, doneDate: "" }
        ]
      },
      {
        id: id(), name: "Resume v13", why: "Every interview so far came from a tailored version", status: "active", due: "",
        tasks: [
          { id: id(), text: "Fold Module 4 lab work into the skills section", done: false, doneDate: "" },
          { id: id(), text: "Ask two people to tear it apart", done: false, doneDate: "" }
        ]
      }
    ];

    return {
      version: 1,
      settings: {
        name: "", theme: "auto", seeded: true, bannerDismissed: false,
        mode: "pro", onboarded: true,
        units: { weight: "lb" },
        modules: { tasks: true, fitness: true, fuel: true, study: true, lab: true }
      },
      counters: { ticket: tickets.length },
      projects: projects,
      workouts: workouts,
      weighins: weighins,
      routine: routine,
      fuelPlan: fuelPlan,
      fuelLogs: fuelLogs,
      supps: supps,
      studyPlan: studyPlan,
      studyLogs: studyLogs,
      plans: plans,
      habits: habits,
      habitChecks: habitChecks,
      zones: zones,
      vms: vms,
      rules: rules,
      tickets: tickets,
      modules: modules,
      certs: certs,
      commands: commands
    };
  };

  /* Simple-mode starter: everyday accounts, a couple of worked examples,
     and one to-do that teaches the app. No jargon, no homelab. */
  OD.seedSimple = function () {
    var id = OD.uid;

    var tickets = [
      {
        id: id(), num: "T-0001", title: "Try me: check off a habit on Home",
        type: "task", area: "home", priority: "medium", status: "open",
        opened: OD.todayISO(), resolved: "",
        symptom: "",
        cause: "",
        fix: "Go to Home and tap one of the habit chips (steps, bed on time, water). That's your day score moving. Then delete this to-do — you've got it.",
        lesson: ""
      }
    ];

    var projects = [
      {
        id: id(), name: "Example project — clear out the garage", why: "So the car fits before winter", status: "active", due: "",
        tasks: [
          { id: id(), text: "Sort everything into keep / donate / trash", done: true, doneDate: daysAgo(1) },
          { id: id(), text: "Drop the donate boxes off", done: false, doneDate: "" },
          { id: id(), text: "Sweep and put shelves up", done: false, doneDate: "" }
        ]
      }
    ];

    return {
      version: 1,
      settings: {
        name: "", theme: "auto", seeded: false, bannerDismissed: true,
        mode: "simple", onboarded: true,
        units: { weight: "lb" },
        modules: { tasks: true, fitness: true, fuel: true, study: true, lab: false }
      },
      counters: { ticket: 1 },
      zones: [],
      vms: [],
      rules: [],
      tickets: tickets,
      modules: [],
      certs: [],
      commands: [],
      plans: [],
      projects: projects,
      workouts: [],
      weighins: [],
      routine: { days: { 0: "", 1: "", 2: "", 3: "", 4: "", 5: "", 6: "" } },
      fuelPlan: null,
      fuelLogs: [],
      supps: [],
      studyPlan: { target: 0 },
      studyLogs: [],
      habits: [
        { id: id(), name: "Steps / daily walk" },
        { id: id(), name: "In bed on time" },
        { id: id(), name: "Enough water" }
      ],
      habitChecks: {}
    };
  };
})();
