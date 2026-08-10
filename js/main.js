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
    toggle.addEventListener("click", function () {
      var open = menu.classList.toggle("open");
      toggle.classList.toggle("open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    menu.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        menu.classList.remove("open");
        toggle.classList.remove("open");
      });
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

  /* ---- Flip cards: tap to flip on touch devices ---- */
  document.querySelectorAll(".flip").forEach(function (f) {
    f.addEventListener("click", function () { f.classList.toggle("flipped"); });
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

  /* ---- Footer year ---- */
  var yr = document.getElementById("year");
  if (yr) yr.textContent = new Date().getFullYear();
})();
