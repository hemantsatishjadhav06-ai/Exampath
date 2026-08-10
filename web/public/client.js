/* ExamPath — client interactivity (framework-free, SSR-safe by construction).
   Live countdowns, eligibility checker, client-side search, follow (localStorage). */
(function () {
  "use strict";
  // Base path when hosted under a sub-directory (set by the exporter via
  // window.__BASE__, e.g. "/exampath" on GitHub Pages). Empty at the root.
  var BASE = (typeof window !== "undefined" && window.__BASE__) || "";
  var MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  var QRANK = { "10th": 1, "12th": 2, graduate: 3, pg: 4 };
  var STATUS_META = {
    application_open: { cls: "p-open", label: "Applications Open" },
    closing_soon: { cls: "p-soon", label: "Closing Soon" },
    upcoming: { cls: "p-up", label: "Upcoming" },
    admit_card: { cls: "p-admit", label: "Admit Card Out" },
    result_awaited: { cls: "p-admit", label: "Result Awaited" },
    result_out: { cls: "p-result", label: "Result Out" },
    completed: { cls: "p-done", label: "Completed" },
  };

  function daysLeft(iso) { return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function inr(n) {
    var s = String(Math.round(n));
    if (s.length <= 3) return s;
    var last3 = s.slice(-3), rest = s.slice(0, -3);
    return rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last3;
  }
  function fmt(iso) {
    var p = iso.split("-");
    return String(+p[2]).padStart(2, "0") + " " + MONTHS[+p[1] - 1] + " " + p[0];
  }

  /* ---------- toast ---------- */
  var toastT;
  function toast(msg) {
    var t = document.getElementById("toast");
    if (!t) return;
    t.textContent = msg;
    t.style.opacity = "1";
    t.style.transform = "translateX(-50%) translateY(0)";
    clearTimeout(toastT);
    toastT = setTimeout(function () {
      t.style.opacity = "0";
      t.style.transform = "translateX(-50%) translateY(20px)";
    }, 2600);
  }

  /* ---------- live countdowns ---------- */
  function tickCountdowns() {
    var now = Date.now();
    document.querySelectorAll("[data-countdown]").forEach(function (el) {
      var d = Math.ceil((new Date(el.getAttribute("data-countdown")).getTime() - now) / 86400000);
      if (el.firstChild) el.firstChild.textContent = d < 0 ? 0 : d;
    });
    document.querySelectorAll("[data-count-to]").forEach(function (box) {
      var target = new Date(box.getAttribute("data-count-to") + "T23:59:59").getTime();
      var diff = Math.max(0, target - now);
      var dd = Math.floor(diff / 86400000); diff -= dd * 86400000;
      var hh = Math.floor(diff / 3600000); diff -= hh * 3600000;
      var mm = Math.floor(diff / 60000);
      var D = box.querySelector(".cu-d"), H = box.querySelector(".cu-h"), M = box.querySelector(".cu-m");
      if (D) D.textContent = dd;
      if (H) H.textContent = hh;
      if (M) M.textContent = mm;
    });
  }
  function startCountdowns() {
    tickCountdowns();
    setInterval(tickCountdowns, 30000);
  }

  /* ---------- eligibility checker ---------- */
  function initEligibility() {
    var btn = document.getElementById("eligCheck");
    if (!btn) return;
    var panel = document.querySelector(".elig");
    btn.addEventListener("click", function () {
      var ageMin = +panel.getAttribute("data-age-min");
      var ageMax = +panel.getAttribute("data-age-max");
      var qcode = panel.getAttribute("data-qcode");
      var exam = panel.getAttribute("data-exam");
      var qual = panel.getAttribute("data-qual");
      var age = parseInt(document.getElementById("eAge").value, 10);
      var pick = document.getElementById("eQual").value;
      var box = document.getElementById("eligRes");
      if (!age) { box.className = "res no"; box.textContent = "Please enter your age."; return; }
      var ageOk = age >= ageMin && age <= ageMax;
      var qualOk = QRANK[pick] >= QRANK[qcode];
      if (ageOk && qualOk) {
        box.className = "res ok";
        box.textContent = "✓ You're eligible for " + exam + "! Age & qualification both match.";
      } else {
        var reasons = [];
        if (!ageOk) reasons.push("age must be " + ageMin + "–" + ageMax);
        if (!qualOk) reasons.push("needs " + qual);
        box.className = "res no";
        box.textContent = "✕ Not eligible: " + reasons.join(" · ") + ".";
      }
    });
  }

  /* ---------- follow (localStorage) ---------- */
  var FKEY = "exampath:following";
  function getFollowing() {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(window.localStorage.getItem(FKEY) || "[]"); } catch (e) { return []; }
  }
  function setFollowing(list) {
    try { window.localStorage.setItem(FKEY, JSON.stringify(list)); } catch (e) {}
  }
  function paintFollow() {
    var set = getFollowing();
    document.querySelectorAll("[data-follow]").forEach(function (el) {
      var on = set.indexOf(el.getAttribute("data-follow")) !== -1;
      if (el.hasAttribute("data-follow-btn")) {
        el.textContent = on ? "✓ Following" : "☆ Follow this exam";
        el.classList.toggle("ghost", on);
        el.classList.toggle("saf", !on);
        el.style.cssText = on ? "background:#fff;color:var(--brand)" : "";
      } else {
        el.classList.toggle("on", on);
        var svg = el.querySelector("svg");
        if (svg) svg.setAttribute("fill", on ? "currentColor" : "none");
      }
      el.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }
  function initFollow() {
    paintFollow();
    document.addEventListener("click", function (e) {
      var el = e.target.closest ? e.target.closest("[data-follow]") : null;
      if (!el) return;
      e.preventDefault();
      var id = el.getAttribute("data-follow");
      var set = getFollowing();
      var i = set.indexOf(id);
      if (i === -1) { set.push(id); toast("★ Added — you'll get deadline alerts"); }
      else { set.splice(i, 1); toast("Removed from your exams"); }
      setFollowing(set);
      paintFollow();
    });
  }

  /* ---------- header search ---------- */
  function initTopSearch() {
    var top = document.getElementById("topSearch");
    if (top) {
      top.addEventListener("keydown", function (e) {
        if (e.key === "Enter") location.href = BASE + "/search/?q=" + encodeURIComponent(top.value || "");
      });
    }
  }

  /* ---------- search page ---------- */
  function parseQuery(qraw, bodies) {
    var q = (qraw || "").toLowerCase().trim();
    var am = q.match(/age\s*(\d{2})|(\d{2})\s*(?:yrs?|years?)|\b(1[89]|2[0-9]|3[0-5])\b/);
    var age = am ? parseInt(am[1] || am[2] || am[3], 10) : null;
    var qual = null;
    if (/graduat|degree|b\.?a|b\.?sc|b\.?com|b\.?tech/.test(q)) qual = "graduate";
    else if (/12th|higher second|intermediate/.test(q)) qual = "12th";
    else if (/10th|matric/.test(q)) qual = "10th";
    var body = null;
    Object.keys(bodies).forEach(function (slug) {
      var b = bodies[slug];
      if (q.indexOf(b.short.toLowerCase()) !== -1 || q.indexOf(b.name.toLowerCase().split(" ")[0]) !== -1) body = slug;
    });
    if (/bank/.test(q)) body = "ibps";
    if (/rail|train/.test(q)) body = "rrb";
    var closingSoon = /clos|soon|deadline|last date/.test(q);
    var labelMap = { graduate: "Graduate", "12th": "12th pass", "10th": "10th pass", pg: "Post-graduate" };
    var labels = [];
    if (body) labels.push(bodies[body].short);
    if (qual) labels.push(labelMap[qual]);
    if (age) labels.push("Age " + age);
    if (closingSoon) labels.push("Closing soon");
    return { q: q, age: age, qual: qual, body: body, closingSoon: closingSoon, labels: labels };
  }
  function pill(status) {
    var m = STATUS_META[status] || STATUS_META.upcoming;
    return '<span class="pill ' + m.cls + '"><span class="dot"></span>' + m.label + "</span>";
  }
  function examCard(c, bodies) {
    var b = bodies[c.body];
    var dl = c.dates.filter(function (d) { return d.is_deadline; })[0];
    var dleft = dl ? daysLeft(dl.date) : null;
    var right = dleft !== null && dleft >= 0
      ? '<div class="f"><b style="color:' + (dleft <= 7 ? "var(--red)" : "var(--ink)") + '">' + dleft + "d</b><span>" + (dl.label.indexOf("Apply") !== -1 ? "To apply" : "To go") + "</span></div>"
      : '<div class="f"><b>&mdash;</b><span>Dates soon</span></div>';
    return '<div class="xcard"><div class="row1">' +
      '<span class="badge" style="background:' + b.color + '1a;color:' + b.color + '">' + b.short + "</span>" +
      '<div style="min-width:0"><h3>' + esc(c.exam) + '</h3><div class="meta">' + esc(b.name.split(" ").slice(0, 3).join(" ")) + " · " + esc(c.qualification) + "</div></div>" +
      '<div style="margin-left:auto">' + pill(c.status) + "</div></div>" +
      '<div class="facts"><div class="f"><b>' + inr(c.vacancy) + "</b><span>Vacancies</span></div>" +
      '<div class="f"><b>' + c.age_min + "&ndash;" + c.age_max + "</b><span>Age</span></div>" + right + "</div>" +
      '<div class="cta"><a class="btn pri sm" href="' + BASE + '/exam/' + c.id + '/">View Dashboard</a>' +
      '<button class="heart" data-follow="' + c.id + '" aria-label="Follow this exam" aria-pressed="false">' +
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s-7-4.35-9.5-8.5C.5 9 2.5 5.5 6 5.5c2 0 3.2 1 4 2.2.8-1.2 2-2.2 4-2.2 3.5 0 5.5 3.5 3.5 7C19 16.65 12 21 12 21z"/></svg></button></div></div>';
  }
  function filterCycles(args, cycles) {
    return cycles.filter(function (c) {
      if (args.body && c.body !== args.body) return false;
      if (args.qual && c.qualification_code !== args.qual) return false;
      if (args.age != null && !(args.age >= c.age_min && args.age <= c.age_max)) return false;
      if (args.closingSoon) {
        var soon = c.dates.some(function (d) { return d.is_deadline && daysLeft(d.date) >= 0 && daysLeft(d.date) <= 30; });
        if (!soon) return false;
      }
      if (args.q && !args.body && !args.qual && !args.closingSoon) {
        var hay = (c.title + c.exam + c.summary + c.posts).toLowerCase();
        if (hay.indexOf(args.q) === -1) return false;
      }
      return true;
    });
  }
  function initSearch() {
    var results = document.getElementById("results");
    var dataEl = document.getElementById("exampath-data");
    if (!results || !dataEl) return;
    var data;
    try { data = JSON.parse(dataEl.textContent); } catch (e) { return; }
    var qraw = new URLSearchParams(location.search).get("q") || "";
    var input = document.getElementById("pageSearch");
    if (input) input.value = qraw;

    var parsed = parseQuery(qraw, data.bodies);
    var res = qraw ? filterCycles(parsed, data.cycles) : data.cycles;

    document.getElementById("resultCount").textContent =
      res.length + " exam" + (res.length !== 1 ? "s" : "") + (qraw ? " found" : "");

    var note = document.getElementById("parseNote");
    if (note) {
      note.innerHTML = parsed.labels.length
        ? '<div class="note-demo" style="margin-bottom:14px">\u{1F50E} Understood your search as: ' +
          parsed.labels.map(function (l) { return "<b>" + esc(l) + "</b>"; }).join(" · ") + "</div>"
        : "";
    }

    var chips = document.getElementById("filterChips");
    if (chips) {
      chips.querySelectorAll(".fchip").forEach(function (a) {
        var f = a.textContent.trim();
        a.classList.toggle("on", qraw.toLowerCase().indexOf(f) !== -1);
      });
    }

    results.innerHTML = res.length
      ? res.map(function (c) { return examCard(c, data.bodies); }).join("")
      : '<div class="card" style="padding:40px;text-align:center;grid-column:1/-1"><div style="font-size:34px">\u{1F50D}</div><h3 style="margin:8px 0">No matches</h3><p class="muted">Try “graduate”, “SSC”, or “age 21”.</p></div>';

    paintFollow();
  }

  /* ---------- boot ---------- */
  function boot() {
    try { startCountdowns(); } catch (e) {}
    try { initEligibility(); } catch (e) {}
    try { initFollow(); } catch (e) {}
    try { initTopSearch(); } catch (e) {}
    try { initSearch(); } catch (e) {}
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
