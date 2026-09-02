/* OpsDesk — chart primitives (no libraries).
   Specs: bars ≤ 24px with a 4px rounded data-end and square baseline,
   2px surface gaps between touching marks, hairline solid gridlines,
   clean y-axis ticks, a legend whenever there are 2+ series, and a
   hover tooltip with a hit target larger than the mark. */
(function () {
  "use strict";

  var charts = OD.charts = {};
  var esc = function (s) { return OD.ui.esc(s); };

  /* Round the axis top up to a clean 1/2/5 × 10^k step ladder. */
  function niceScale(max, tickCount) {
    if (max <= 0) max = 1;
    var rough = max / tickCount;
    var pow = Math.pow(10, Math.floor(Math.log10(rough)));
    var norm = rough / pow;
    var step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
    step *= pow;
    return { step: step, top: step * tickCount };
  }

  /* Bar path: square at the baseline, 4px radius at the data end. */
  function topRoundedRect(x, y, w, h, r) {
    r = Math.min(r, w / 2, h);
    return "M" + x + "," + (y + h) +
      " L" + x + "," + (y + r) +
      " Q" + x + "," + y + " " + (x + r) + "," + y +
      " L" + (x + w - r) + "," + y +
      " Q" + (x + w) + "," + y + " " + (x + w) + "," + (y + r) +
      " L" + (x + w) + "," + (y + h) + " Z";
  }

  /* Grouped column chart.
     opts: { labels: [..], series: [{ name, color (css value), values: [..] }],
             height, format(n) → tooltip/tick text } */
  charts.columns = function (container, opts) {
    var labels = opts.labels;
    var series = opts.series;
    var H = opts.height || 210;
    var fmtV = opts.format || function (n) { return OD.fmt.num(n); };

    container.innerHTML = "";

    if (series.length >= 2) {
      var legend = document.createElement("div");
      legend.className = "chart-legend";
      legend.innerHTML = series.map(function (s) {
        return '<span class="key"><span class="swatch" style="background:' + s.color + '"></span>' + esc(s.name) + "</span>";
      }).join("");
      container.appendChild(legend);
    }

    var box = document.createElement("div");
    box.className = "chart-box";
    container.appendChild(box);

    var W = Math.max(280, box.clientWidth || container.clientWidth || 560);
    var pad = { l: 48, r: 6, t: 8, b: 24 };
    var plotW = W - pad.l - pad.r;
    var plotH = H - pad.t - pad.b;

    var maxVal = 0;
    series.forEach(function (s) {
      s.values.forEach(function (v) { if (v > maxVal) maxVal = v; });
    });
    var TICKS = 4;
    var scale = niceScale(maxVal, TICKS);
    var y = function (v) { return pad.t + plotH - (v / scale.top) * plotH; };

    var svg = "";

    // gridlines + tick labels
    for (var t = 0; t <= TICKS; t++) {
      var val = scale.step * t;
      var gy = y(val);
      svg += '<line x1="' + pad.l + '" y1="' + gy + '" x2="' + (W - pad.r) + '" y2="' + gy +
        '" style="stroke:var(--line);stroke-width:1"/>';
      svg += '<text x="' + (pad.l - 8) + '" y="' + (gy + 3.5) + '" text-anchor="end" font-size="11" style="fill:var(--muted)">' +
        esc(fmtV(val)) + "</text>";
    }

    var n = labels.length;
    var groupW = plotW / n;
    var GAP = 2; // surface gap between touching bars
    var barW = Math.min(24, Math.floor((groupW * 0.62 - GAP * (series.length - 1)) / series.length));
    if (barW < 3) barW = 3;
    var clusterW = barW * series.length + GAP * (series.length - 1);

    var hits = []; // hover targets, drawn last so they sit on top

    labels.forEach(function (label, i) {
      var gx = pad.l + i * groupW;
      var startX = gx + (groupW - clusterW) / 2;

      series.forEach(function (s, si) {
        var v = s.values[i] || 0;
        var bx = startX + si * (barW + GAP);
        var by = y(v);
        var bh = pad.t + plotH - by;
        if (v > 0 && bh < 2) { bh = 2; by = pad.t + plotH - 2; }
        if (v > 0) {
          svg += '<path d="' + topRoundedRect(bx, by, barW, bh, 4) + '" style="fill:' + s.color + '"/>';
        }
        hits.push({
          x: bx - 3, w: barW + 6,
          cx: bx + barW / 2, topY: v > 0 ? by : pad.t + plotH,
          label: label, name: s.name, value: v
        });
      });

      svg += '<text x="' + (gx + groupW / 2) + '" y="' + (H - 7) + '" text-anchor="middle" font-size="11" style="fill:var(--muted)">' +
        esc(label) + "</text>";
    });

    // baseline over the bars' square ends
    svg += '<line x1="' + pad.l + '" y1="' + (pad.t + plotH) + '" x2="' + (W - pad.r) + '" y2="' + (pad.t + plotH) +
      '" style="stroke:var(--line);stroke-width:1"/>';

    hits.forEach(function (h, idx) {
      svg += '<rect data-hit="' + idx + '" x="' + h.x + '" y="' + pad.t + '" width="' + h.w + '" height="' + plotH +
        '" fill="transparent"/>';
    });

    box.innerHTML = '<svg class="chart-svg" width="100%" height="' + H + '" viewBox="0 0 ' + W + " " + H +
      '" role="img" aria-label="' + esc(opts.ariaLabel || "Column chart") + '">' + svg + "</svg>" +
      '<div class="chart-tip"></div>';

    var tip = box.querySelector(".chart-tip");
    box.querySelectorAll("[data-hit]").forEach(function (r) {
      var h = hits[Number(r.getAttribute("data-hit"))];
      r.addEventListener("mouseenter", function () {
        tip.innerHTML = "<b>" + esc(h.label) + "</b> · " + esc(h.name) + ": " + esc(fmtV(h.value));
        tip.style.display = "block";
        var scaleX = box.clientWidth / W;
        var left = h.cx * scaleX;
        tip.style.left = Math.max(40, Math.min(box.clientWidth - 40, left)) + "px";
        tip.style.top = Math.max(0, h.topY - 34) + "px";
        tip.style.transform = "translateX(-50%)";
      });
      r.addEventListener("mouseleave", function () { tip.style.display = "none"; });
    });
  };

  /* Horizontal bar list (single hue — identity comes from the row label). */
  charts.hbars = function (rows, format) {
    var max = 1;
    rows.forEach(function (r) { if (r.value > max) max = r.value; });
    return rows.map(function (r) {
      var pct = (r.value / max) * 100;
      return '<div class="hbar-row">' +
        '<span class="hbar-label">' + esc(r.label) + "</span>" +
        '<span class="hbar-track"><span class="hbar-fill" style="width:' + pct + '%"></span></span>' +
        '<span class="hbar-count">' + esc(format ? format(r.value) : OD.fmt.num(r.value)) + "</span>" +
        "</div>";
    }).join("");
  };

  /* Progress meter — filled accent on a lighter step of the same ramp. */
  charts.meter = function (pct) {
    pct = Math.max(0, Math.min(100, pct));
    return '<div class="meter" role="progressbar" aria-valuenow="' + Math.round(pct) +
      '" aria-valuemin="0" aria-valuemax="100"><span style="width:' + pct + '%"></span></div>';
  };
})();
