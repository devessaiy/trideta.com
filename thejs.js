/* =========================================================
   RESMAN WEBSITE — SCRIPT
   - On-load hero animations
   - Scroll reveal (Intersection Observer)
   - Sticky nav state
   - Mobile hamburger
   - Pillar scroll sync
   - Analytics bar & counter animations
   - Pricing fetch + render
   - Demo video play
   - Year footer
   ========================================================= */

'use strict';

/* ── UTILITIES ─────────────────────────────────────────── */
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
const raf = requestAnimationFrame;

function lerp(a, b, t) { return a + (b - a) * t; }

/* ── YEAR ───────────────────────────────────────────────── */
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();


/* ── NAV SCROLL STATE + THEME DETECTION ─────────────────── */
const topbar = document.getElementById('topbar');

/**
 * Walk every [data-nav-theme] section and check if the middle of the
 * nav bar (its vertical centre) falls inside that section's bounding rect.
 * The last match wins, so sections lower in the DOM correctly override
 * earlier ones when they're taller than the viewport.
 */
function getNavTheme() {
  const navMid = topbar.offsetHeight / 2;
  let theme = 'dark'; // hero is the first section, default stays dark

  document.querySelectorAll('[data-nav-theme]').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.top <= navMid && r.bottom > navMid) {
      theme = el.dataset.navTheme;
    }
  });

  return theme;
}

function updateNav() {
  const y     = window.scrollY;
  const theme = getNavTheme();

  topbar.classList.toggle('scrolled',  y > 30);
  topbar.classList.toggle('nav-light', theme === 'light');
}

window.addEventListener('scroll', updateNav, { passive: true });
updateNav(); // run once on load


/* ── HAMBURGER ──────────────────────────────────────────── */
const hamburger = document.getElementById('hamburger');
const navDrawer  = document.getElementById('navDrawer');

if (hamburger && navDrawer) {
  function setDrawer(open) {
    hamburger.classList.toggle('open', open);
    navDrawer.classList.toggle('open', open);
    hamburger.setAttribute('aria-expanded', String(open));
    navDrawer.setAttribute('aria-hidden', String(!open));
    document.body.style.overflow = open ? 'hidden' : '';
  }

  hamburger.addEventListener('click', () => {
    setDrawer(!hamburger.classList.contains('open'));
  });

  // Close on nav link click
  $$('a', navDrawer).forEach(a => {
    a.addEventListener('click', () => setDrawer(false));
  });
}


/* ── HERO ENTRANCE ANIMATIONS ───────────────────────────── */
function runHeroAnimations() {
  const els = $$('[data-animate]');
  els.forEach(el => {
    const delay = parseFloat(el.dataset.delay || 0);
    setTimeout(() => {
      el.classList.add('visible');
    }, delay * 1000);
  });
}
// Start after a brief paint delay
setTimeout(runHeroAnimations, 80);


/* ── SCROLL REVEAL ──────────────────────────────────────── */
const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        // Stagger siblings within same parent
        const siblings = $$('[data-reveal]', entry.target.parentElement);
        const idx = siblings.indexOf(entry.target);
        const delay = Math.min(idx * 80, 320);
        setTimeout(() => {
          entry.target.classList.add('revealed');
        }, delay);
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
);

$$('[data-reveal]').forEach(el => revealObserver.observe(el));


/* ── PILLAR SCROLL SYNC ─────────────────────────────────── */
const pillarItems  = $$('.pillar-item');
const pmocks       = $$('.pmock');

function getActivePillar() {
  let active = null;
  pillarItems.forEach(item => {
    const rect = item.getBoundingClientRect();
    if (rect.top <= window.innerHeight * 0.55 && rect.bottom >= window.innerHeight * 0.25) {
      active = item;
    }
  });
  return active || pillarItems[0];
}

function updatePillarMockup(key) {
  pmocks.forEach(m => m.classList.toggle('active', m.id === `pmock-${key}`));
}

function onPillarScroll() {
  if (window.innerWidth < 900) return; // skip on mobile
  const active = getActivePillar();
  if (!active) return;

  pillarItems.forEach(p => p.classList.toggle('active', p === active));
  updatePillarMockup(active.dataset.pillar || 'control');
}

window.addEventListener('scroll', onPillarScroll, { passive: true });
onPillarScroll();


/* ── ANALYTICS BAR & COUNTER ────────────────────────────── */
function animateCount(el, target, duration = 1800) {
  const start = performance.now();
  const fmt   = new Intl.NumberFormat('en-NG');

  function step(now) {
    const p = Math.min((now - start) / duration, 1);
    // Ease out cubic
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = '₦' + fmt.format(Math.round(target * eased));
    if (p < 1) raf(step);
  }
  raf(step);
}

const analyticsSection = $('.analytics-section');
let analyticsAnimated  = false;

const analyticsObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !analyticsAnimated) {
        analyticsAnimated = true;

        // Animate revenue counter
        const countEl = $('[data-countup]');
        if (countEl) {
          const target = parseInt(countEl.dataset.countup, 10);
          animateCount(countEl, target);
        }

        // Animate bars
        $$('.ap-fill').forEach(fill => {
          raf(() => fill.classList.add('animated'));
        });
      }
    });
  },
  { threshold: 0.3 }
);

if (analyticsSection) analyticsObserver.observe(analyticsSection);


/* ── BILLING TOGGLE ─────────────────────────────────────── */
let currentPeriod = 'monthly';
let plansData     = [];

const btoggles = $$('.btoggle');
btoggles.forEach(btn => {
  btn.addEventListener('click', () => {
    btoggles.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentPeriod = btn.dataset.period;
    if (plansData.length) renderPricing(plansData);
  });
});


/* ── PRICING FETCH ──────────────────────────────────────── */
function buildPricingCard(plan, period, anyTrial) {
  const isFree      = plan.is_free;
  const trialDays   = parseInt(plan.trial_days)   || 0;
  const discountPct = parseInt(plan.discount_pct) || 0;
  const rawAmount   = period === 'yearly' ? plan.price_yearly : plan.price_monthly;
  const periodText  = isFree ? '' : (period === 'yearly' ? '/yr' : '/mo');

  // Build discounted display if applicable (API sends formatted strings like '₦16,667')
  let priceHtml;
  if (!isFree && discountPct > 0) {
    const rawStr   = rawAmount.replace(/[₦,]/g, '');
    const rawNum   = parseFloat(rawStr) || 0;
    const discNum  = Math.round(rawNum * (1 - discountPct / 100));
    const discStr  = '₦' + discNum.toLocaleString('en-NG');
    priceHtml = `
      <span class="pc-amount">${discStr}</span>
      ${periodText ? `<span class="pc-period">${periodText}</span>` : ''}
      <span style="font-size:0.8rem;color:var(--text-muted,#6b7280);text-decoration:line-through;margin-left:4px;">${rawAmount}</span>`;
  } else {
    priceHtml = `
      <span class="pc-amount">${rawAmount}</span>
      ${periodText ? `<span class="pc-period">${periodText}</span>` : ''}`;
  }

  // Badges: trial and/or discount
  const badges = [
    trialDays   > 0 ? `<span class="pc-trial-badge">${trialDays}-day free trial</span>` : '',
    discountPct > 0 ? `<span class="pc-discount-badge">${discountPct}% off</span>`      : '',
  ].filter(Boolean).join('');

  // CTA: own trial days wins; otherwise if any plan has a trial, replace "Talk to sales" with "Start trial"
  let ctaLabel;
  if (trialDays > 0) {
    ctaLabel = `Start ${trialDays}-day trial`;
  } else if (anyTrial && plan.cta === 'Talk to sales') {
    ctaLabel = 'Start trial';
  } else {
    ctaLabel = plan.cta;
  }

  const card = document.createElement('div');
  card.className = 'pricing-card' + (plan.featured ? ' featured' : '');

  card.innerHTML = `
    <div class="pc-top">
      <span class="pc-name">${plan.name}</span>
      ${plan.featured ? '<span class="pc-badge">Most popular</span>' : ''}
    </div>
    ${badges ? `<div class="pc-badges">${badges}</div>` : ''}
    <div class="pc-price">${priceHtml}</div>
    <p class="pc-tagline">${plan.tagline}</p>
    <ul class="pc-features">
      ${plan.features.map(f => `<li>${f}</li>`).join('')}
    </ul>
    <a href="https://app.resman.ng/register.php?plan=${encodeURIComponent(plan.key)}"
       class="btn ${plan.featured ? 'primary' : 'outline'} full-width">
      ${ctaLabel}
    </a>
  `;

  return card;
}

function renderPricing(plans) {
  const grid = document.getElementById('pricingGrid');
  if (!grid) return;
  grid.innerHTML = '';
  const anyTrial = plans.some(p => (parseInt(p.trial_days) || 0) > 0);
  plans.forEach((plan, i) => {
    const card = buildPricingCard(plan, currentPeriod, anyTrial);
    card.style.animationDelay = `${i * 80}ms`;
    grid.appendChild(card);
  });
}

async function fetchPlans() {
  // Determine API base: same origin for local dev, absolute for production
  const isLocal    = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  const apiBase    = isLocal ? '/resman/api' : 'https://app.resman.ng/api';
  const url        = `${apiBase}/plans`;

  try {
    const res  = await fetch(url, { headers: { Accept: 'application/json' } });
    const json = await res.json();
    if (json.success && Array.isArray(json.data?.plans)) {
      plansData = json.data.plans;
      renderPricing(plansData);
    } else {
      throw new Error('Bad response');
    }
  } catch (err) {
    console.warn('[Resman] Pricing fetch failed, showing fallback.', err);
    renderFallbackPricing();
  }
}

function renderFallbackPricing() {
  plansData = [
    {
      key: 'starter', name: 'Starter', tagline: 'Perfect for one branch that needs clarity now.',
      featured: false, cta: 'Start free trial', is_free: true,
      price_monthly: 'Free', price_yearly: 'Free', trial_days: 0, discount_pct: 0,
      features: ['1 branch','Up to 5 staff accounts','Sales, inventory & expense tracking','Basic reports & email summaries'],
    },
    {
      key: 'growth', name: 'Growth', tagline: 'For operators scaling across the city.',
      featured: true, cta: 'Get started', is_free: false,
      price_monthly: '₦16,667', price_yearly: '₦200,000', trial_days: 0, discount_pct: 0,
      features: ['Up to 3 branches','Up to 15 staff accounts','Unlimited products','Advanced analytics & alerts','Online menu','Priority support'],
    },
    {
      key: 'business', name: 'Business', tagline: 'For established chains that need full control.',
      featured: false, cta: 'Talk to sales', is_free: false,
      price_monthly: '₦41,667', price_yearly: '₦500,000', trial_days: 0, discount_pct: 0,
      features: ['Up to 10 branches','Up to 30 staff accounts','Unlimited products','Full feature access','Online storefront + Paystack','Dedicated account manager'],
    },
  ];
  renderPricing(plansData);
}

// Fetch after DOM is painted
if (document.getElementById('pricingGrid')) {
  fetchPlans();
}


/* ── VIDEO DEMO ─────────────────────────────────────────── */
const videoPoster    = document.getElementById('videoPoster');
const videoFrame     = document.getElementById('videoFrame');
const ytFrame        = document.getElementById('ytFrame');

// Replace this with your actual YouTube video ID
const YOUTUBE_VIDEO_ID = 'VIDEO_ID_HERE';

if (videoPoster && videoFrame && ytFrame) {
  function loadVideo() {
    if (YOUTUBE_VIDEO_ID === 'VIDEO_ID_HERE') {
      // No video set yet — just hide the poster and show a placeholder
      videoPoster.style.display = 'none';
      videoFrame.removeAttribute('hidden');
      videoFrame.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
                    height:100%;background:#0d0d10;color:rgba(255,255,255,.4);gap:12px;font-size:.9rem;">
          <div style="font-size:2.5rem;">🎬</div>
          <span>Demo video coming soon</span>
        </div>`;
      return;
    }
    ytFrame.src = `https://www.youtube.com/embed/${YOUTUBE_VIDEO_ID}?autoplay=1&rel=0&modestbranding=1`;
    videoPoster.style.display = 'none';
    videoFrame.removeAttribute('hidden');
  }

  videoPoster.addEventListener('click', loadVideo);
  videoPoster.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); loadVideo(); }
  });
}


/* ── SMOOTH SECTION HASH SCROLL ─────────────────────────── */
document.addEventListener('click', e => {
  const link = e.target.closest('a[href^="#"]');
  if (!link) return;
  const id = link.getAttribute('href').slice(1);
  const target = document.getElementById(id) || (id === '' && document.documentElement);
  if (!target) return;
  e.preventDefault();
  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
});
