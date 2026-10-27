/* =========================================================
   PRIMEGATE CONSULTANCY - Interactions
   No dependencies. Vanilla JS.
   ========================================================= */
(function () {
  "use strict";

  /* ---- Sticky header ---- */
  var header = document.querySelector(".site-header");
  function onScroll() {
    if (!header) return;
    if (window.scrollY > 40) header.classList.add("scrolled");
    else header.classList.remove("scrolled");
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---- Mobile nav ---- */
  var toggle = document.querySelector(".nav__toggle");
  var menu = document.querySelector(".nav__menu");
  if (toggle && menu) {
    function closeMenu() {
      menu.classList.remove("open");
      toggle.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    }
    toggle.addEventListener("click", function (e) {
      e.stopPropagation();
      var open = menu.classList.toggle("open");
      toggle.classList.toggle("open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    menu.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", closeMenu);
    });
    // Close the mobile menu when tapping anywhere outside it
    document.addEventListener("click", function (e) {
      if (!menu.classList.contains("open")) return;
      if (menu.contains(e.target) || toggle.contains(e.target)) return;
      closeMenu();
    });
    // Close on Escape
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeMenu();
    });
  }

  /* ---- Scroll reveal ---- */
  var revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && revealEls.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
      });
    }, { threshold: 0.15, rootMargin: "0px 0px -8% 0px" });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("in"); });
  }

  /* ---- Count-up counters ---- */
  function animateCount(el) {
    var target = parseFloat(el.getAttribute("data-count"));
    var suffix = el.getAttribute("data-suffix") || "";
    var prefix = el.getAttribute("data-prefix") || "";
    var dur = 1800, start = null;
    function tick(ts) {
      if (!start) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      var val = Math.floor(eased * target);
      el.textContent = prefix + val.toLocaleString() + suffix;
      if (p < 1) requestAnimationFrame(tick);
      else el.textContent = prefix + target.toLocaleString() + suffix;
    }
    requestAnimationFrame(tick);
  }
  var counters = document.querySelectorAll("[data-count]");
  if ("IntersectionObserver" in window && counters.length) {
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { animateCount(e.target); cio.unobserve(e.target); }
      });
    }, { threshold: 0.5 });
    counters.forEach(function (c) { cio.observe(c); });
  } else {
    counters.forEach(function (c) { c.textContent = (c.getAttribute("data-prefix")||"") + c.getAttribute("data-count") + (c.getAttribute("data-suffix")||""); });
  }

  /* ---- Accordions (pillars + FAQ) ---- */
  function bindAccordion(headSel, itemSel, bodySel) {
    document.querySelectorAll(headSel).forEach(function (head) {
      head.addEventListener("click", function () {
        var item = head.closest(itemSel);
        var body = item.querySelector(bodySel);
        var isOpen = item.classList.contains("open");
        // close siblings within same group
        var group = item.parentElement;
        group.querySelectorAll(itemSel + ".open").forEach(function (o) {
          if (o !== item) { o.classList.remove("open"); var b = o.querySelector(bodySel); if (b) b.style.maxHeight = null; }
        });
        if (isOpen) { item.classList.remove("open"); body.style.maxHeight = null; }
        else { item.classList.add("open"); body.style.maxHeight = body.scrollHeight + "px"; }
      });
    });
  }
  bindAccordion(".pillar__head", ".pillar", ".pillar__body");
  bindAccordion(".faq__q", ".faq__item", ".faq__a");
  bindAccordion(".prog-acc__head", ".prog-acc__item", ".prog-acc__body");

  /* ---- Flip cards: tap to flip on touch devices ---- */
  document.querySelectorAll(".flip").forEach(function (f) {
    f.addEventListener("click", function () { f.classList.toggle("flipped"); });
  });

  /* ---- Institution marquee: duplicate tiles for a seamless loop ---- */
  document.querySelectorAll("[data-marquee]").forEach(function (track) {
    if (track.getAttribute("data-cloned")) return;
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    var originals = Array.prototype.slice.call(track.children);
    originals.forEach(function (node) {
      var clone = node.cloneNode(true);
      clone.setAttribute("aria-hidden", "true");
      track.appendChild(clone);
    });
    track.setAttribute("data-cloned", "true");
  });

  /* ---- Tabs ---- */
  document.querySelectorAll("[data-tabs]").forEach(function (group) {
    var btns = group.querySelectorAll(".tabs__btn");
    var panels = group.querySelectorAll(".tabs__panel");
    btns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-tab");
        btns.forEach(function (b) { b.classList.toggle("active", b === btn); });
        panels.forEach(function (p) { p.classList.toggle("active", p.getAttribute("data-panel") === id); });
      });
    });
  });

  /* ---- Contact form submission feedback ---- */
  var formStatus = document.querySelector("[data-form-status]");
  if (formStatus) {
    var submissionStatus = new URLSearchParams(window.location.search).get("status");
    if (submissionStatus === "sent") {
      formStatus.textContent = "Thank you. Your enquiry has been sent successfully. We will respond within one working day.";
      formStatus.classList.add("form-status--success");
      formStatus.hidden = false;
    } else if (submissionStatus === "error") {
      formStatus.textContent = "We could not send your enquiry. Please try again or email info@primegateconsultancy.com.";
      formStatus.classList.add("form-status--error");
      formStatus.hidden = false;
    }
  }

  /* ---- Testimonial carousels ---- */
  document.querySelectorAll("[data-carousel]").forEach(function (car) {
    var slides = car.querySelectorAll(".tslide");
    var dotsWrap = car.querySelector(".tdots");
    var i = 0, timer;
    slides.forEach(function (_, idx) {
      var d = document.createElement("button");
      d.className = "tdot" + (idx === 0 ? " active" : "");
      d.setAttribute("aria-label", "Go to slide " + (idx + 1));
      d.addEventListener("click", function () { go(idx); reset(); });
      if (dotsWrap) dotsWrap.appendChild(d);
    });
    var dots = dotsWrap ? dotsWrap.querySelectorAll(".tdot") : [];
    function go(n) {
      slides[i].classList.remove("active"); if (dots[i]) dots[i].classList.remove("active");
      i = (n + slides.length) % slides.length;
      slides[i].classList.add("active"); if (dots[i]) dots[i].classList.add("active");
    }
    function reset() { clearInterval(timer); timer = setInterval(function () { go(i + 1); }, 5500); }
    if (slides.length > 1) {
      reset();
      car.addEventListener("mouseenter", function () { clearInterval(timer); });
      car.addEventListener("mouseleave", reset);
    }
  });

  /* ---- Hero rotating slideshow ---- */
  var heroSlides = document.querySelectorAll(".hero__slides img");
  if (heroSlides.length > 1) {
    var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduceMotion) {
      var hi = 0;
      setInterval(function () {
        heroSlides[hi].classList.remove("is-active");
        hi = (hi + 1) % heroSlides.length;
        heroSlides[hi].classList.add("is-active");
      }, 4000);
    }
  }

  /* ---- Hero background video ----
     The poster image is the LCP element. The video is only fetched once the
     page has fully loaded AND the poster has decoded, then waits for the
     browser to go idle, so it never competes with the first paint. Skipped
     for reduced-motion / data-saver / slow connections (they keep the
     poster). Portrait screens get a cropped 9:16 file. */
  var heroVideo = document.querySelector(".hero__video video");
  if (heroVideo) {
    var conn = navigator.connection || {};
    var skipVideo = (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) ||
      conn.saveData || /(^|-)2g$/.test(conn.effectiveType || "");
    if (!skipVideo) {
      var startHeroVideo = function () {
        var portrait = window.matchMedia("(max-aspect-ratio: 1/1)").matches;
        heroVideo.src = portrait ? heroVideo.dataset.srcPortrait : heroVideo.dataset.src;
        heroVideo.addEventListener("playing", function () { heroVideo.classList.add("is-playing"); }, { once: true });
        var p = heroVideo.play();
        if (p && p.catch) p.catch(function () { /* autoplay blocked (e.g. low-power mode): poster stays */ });
      };
      var poster = document.querySelector(".hero__video img");
      var whenIdle = function () {
        if ("requestIdleCallback" in window) window.requestIdleCallback(startHeroVideo, { timeout: 3000 });
        else setTimeout(startHeroVideo, 1500);
      };
      var afterPoster = function () {
        if (poster && poster.decode && !poster.complete) poster.decode().then(whenIdle, whenIdle);
        else whenIdle();
      };
      if (document.readyState === "complete") afterPoster();
      else window.addEventListener("load", afterPoster, { once: true });
    }
  }

  /* ---- Nav dropdown groups (Services, Partner With Us) ---- */
  var groupToggles = document.querySelectorAll(".nav__grouptoggle");
  groupToggles.forEach(function (btn) {
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      var group = btn.closest(".nav__group");
      var isOpen = group.classList.toggle("open");
      btn.setAttribute("aria-expanded", isOpen ? "true" : "false");
      document.querySelectorAll(".nav__group").forEach(function (g) {
        if (g !== group) {
          g.classList.remove("open");
          var b = g.querySelector(".nav__grouptoggle");
          if (b) b.setAttribute("aria-expanded", "false");
        }
      });
    });
  });
  document.addEventListener("click", function (e) {
    if (!e.target.closest(".nav__group")) {
      document.querySelectorAll(".nav__group.open").forEach(function (g) {
        g.classList.remove("open");
        var b = g.querySelector(".nav__grouptoggle");
        if (b) b.setAttribute("aria-expanded", "false");
      });
    }
  });

  /* ---- Institution directory: name search + destination chips ---- */
  var dir = document.querySelector("[data-directory]");
  if (dir) {
    var dq = dir.querySelector("#dir-q");
    var chips = dir.querySelectorAll("[data-region]");
    var cards = dir.querySelectorAll("[data-name]");
    var blocks = dir.querySelectorAll("[data-region-block]");
    var dirEmpty = dir.querySelector("[data-dir-empty]");
    var dirStatus = dir.querySelector("[data-dir-status]");
    var region = "";
    var filterDir = function () {
      var q = (dq.value || "").trim().toLowerCase();
      var shown = 0;
      cards.forEach(function (c) {
        var inRegion = !region || (" " + c.closest("[data-region-block]").getAttribute("data-region-block") + " ").indexOf(" " + region + " ") !== -1;
        var ok = inRegion && (!q || c.getAttribute("data-name").toLowerCase().indexOf(q) !== -1);
        c.hidden = !ok;
        if (ok) shown++;
      });
      // Hide a region (or sub-region) heading when none of its cards are visible.
      Array.prototype.slice.call(blocks).reverse().forEach(function (b) {
        b.hidden = !b.querySelector("[data-name]:not([hidden])");
      });
      dirEmpty.hidden = shown > 0;
      dirStatus.textContent = shown + (shown === 1 ? " institution shown" : " institutions shown");
    };
    chips.forEach(function (b) {
      b.addEventListener("click", function () {
        region = b.getAttribute("data-region");
        chips.forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
        filterDir();
      });
    });
    dq.addEventListener("input", filterDir);
  }

  /* ---- Zoho form auto-height ----
     Iframes with data-zoho-autosize load with ?zf_rszfm=1, so Zoho posts
     "formperma|height" (and "formperma|height|scroll" on a page change).
     The fixed inline height stays as the fallback if no message arrives. */
  var zohoFrames = document.querySelectorAll("iframe[data-zoho-autosize]");
  if (zohoFrames.length) {
    window.addEventListener("message", function (e) {
      if (!/^https:\/\/forms\.zohopublic\.(com|eu|in)$/.test(e.origin) || typeof e.data !== "string") return;
      var parts = e.data.split("|");
      if (parts.length < 2 || parts.length > 3) return;
      var h = parseInt(parts[1], 10);
      if (!h) return;
      zohoFrames.forEach(function (f) {
        if (f.src.indexOf(parts[0]) === -1) return;
        f.style.height = (h + 15) + "px";
        // Moving to the next form page: bring the top of the form back into view.
        if (parts.length === 3) {
          var card = f.closest("#apply") || f;
          card.scrollIntoView({ block: "start" });
        }
      });
    });
  }

  /* ---- Partner pages: "Fill the form" returns to the form on the same page,
     so anything already typed in the iframe is kept ---- */
  var partnerPage = document.querySelector("[data-partner-page]");
  var formCard = document.getElementById("apply");
  if (partnerPage && formCard) {
    document.querySelectorAll("[data-to-form]").forEach(function (a) {
      a.addEventListener("click", function (e) {
        e.preventDefault();
        formCard.scrollIntoView({ behavior: "smooth", block: "start" });
        if (history.replaceState) history.replaceState(null, "", "#apply");
      });
    });
    // Mobile: a "Fill the form" bar while the form is scrolled out of view (below it only).
    var bar = document.querySelector(".stickybar");
    if (bar && "IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        var r = entries[0];
        bar.classList.toggle("show", !r.isIntersecting && r.boundingClientRect.top < 0);
      }).observe(formCard);
    }
    // Links that leave the page open in a new tab so a half-filled form is not lost.
    partnerPage.querySelectorAll('a[href^="/"], a[href^="http"]').forEach(function (a) {
      a.target = "_blank";
      a.rel = "noopener";
    });
  }

  /* ---- Blog TOC: mark the section being read (aria-current drives the highlight) ---- */
  var toc = document.querySelector("[data-toc]");
  if (toc) {
    var tocLinks = Array.prototype.slice.call(toc.querySelectorAll('a[href^="#"]'));
    var heads = tocLinks.map(function (a) { return document.getElementById(a.getAttribute("href").slice(1)); }).filter(Boolean);
    var setCurrent = function (id) {
      tocLinks.forEach(function (a) {
        if (a.getAttribute("href") === "#" + id) a.setAttribute("aria-current", "true");
        else a.removeAttribute("aria-current");
      });
    };
    // The current section is the last heading that has scrolled above the top band of the screen.
    var pickCurrent = function () {
      var line = 140, current = null;
      heads.forEach(function (h) { if (h.getBoundingClientRect().top - line <= 0) current = h; });
      if (current) setCurrent(current.id);
      else tocLinks.forEach(function (a) { a.removeAttribute("aria-current"); });
    };
    var tocTick = 0;
    window.addEventListener("scroll", function () {
      if (tocTick) return;
      tocTick = requestAnimationFrame(function () { tocTick = 0; pickCurrent(); });
    }, { passive: true });
    pickCurrent();
  }

  /* ---- Footer year ---- */
  var yr = document.getElementById("year");
  if (yr) yr.textContent = new Date().getFullYear();
})();
