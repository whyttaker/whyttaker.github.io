/* ── Day / Night mode toggle ────────────────────────────── */
(function () {
  const STORAGE_KEY = 'ww-theme';
  const darkVideo = document.querySelector('.bg-video');

  // Inject a second always-playing video for the light background
  const lightVideo = document.createElement('video');
  lightVideo.className = 'bg-video bg-video-light';
  lightVideo.autoplay = true;
  lightVideo.muted    = true;
  lightVideo.loop     = true;
  lightVideo.setAttribute('playsinline', '');
  lightVideo.innerHTML = '<source src="/videos/alternate background.mp4" type="video/mp4">';
  if (darkVideo) darkVideo.after(lightVideo);
  else document.body.prepend(lightVideo);
  lightVideo.play().catch(() => {});

  // Apply saved theme immediately before paint (no flash)
  const isLightOnLoad = localStorage.getItem(STORAGE_KEY) === 'light';
  if (isLightOnLoad) document.body.classList.add('light');

  // Build toggle button
  const btn = document.createElement('button');
  btn.className = 'theme-toggle';
  btn.setAttribute('aria-label', 'Toggle light/dark mode');
  btn.innerHTML = `
    <span class="theme-toggle-icon theme-toggle-moon">☽</span>
    <span class="theme-toggle-icon theme-toggle-sun">✦</span>
  `;
  document.body.appendChild(btn);

  btn.addEventListener('click', () => {
    const isLight = document.body.classList.toggle('light');
    localStorage.setItem(STORAGE_KEY, isLight ? 'light' : 'dark');
  });
})();

/* ── Experience card focus overlay ─────────────────────── */
(function () {
  const expTeams = document.querySelectorAll('.exp-team, .detail-block.has-img');
  if (!expTeams.length) return;

  // Build overlay once
  const overlay = document.createElement('div');
  overlay.className = 'focus-overlay';

  const modal = document.createElement('div');
  modal.className = 'focus-modal glass';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'focus-close';
  closeBtn.innerHTML = '&#x2715;'; // ×
  closeBtn.setAttribute('aria-label', 'Close');

  modal.appendChild(closeBtn);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  function openFocus(card) {
    // Clone content, excluding the expand-hint span
    const clone = card.cloneNode(true);
    clone.querySelector('.expand-hint')?.remove();
    // Remove inline transform set by tilt JS
    clone.style.transform = '';
    clone.style.cursor    = 'default';

    // Clear previous content (keep close button)
    while (modal.children.length > 1) modal.removeChild(modal.lastChild);
    modal.appendChild(clone);

    overlay.classList.add('visible');
    document.body.style.overflow = 'hidden';
  }

  function closeFocus() {
    overlay.classList.remove('visible');
    document.body.style.overflow = '';
  }

  expTeams.forEach(card => {
    card.addEventListener('click', () => openFocus(card));
  });

  closeBtn.addEventListener('click', closeFocus);

  // Click backdrop to close
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeFocus();
  });

  // Escape key to close
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeFocus();
  });
})();

/* ── Sidebar slide ───────────────────────────────────────── */
const sidebar = document.querySelector('.sidebar');
if (sidebar) {
  sidebar.addEventListener('mouseenter', () => sidebar.classList.add('is-open'));
  sidebar.addEventListener('mouseleave', () => sidebar.classList.remove('is-open'));
}

/* ── Card 3-D tilt on cursor move ───────────────────────── */
// Uses document-level mousemove against pre-captured rects so the
// card's own transform never interferes with hit detection.

const TILT_SEL = [
  '.dest-card',
  '.proj-card',
  '.about-card',
  '.exp-header',
  '.exp-team',
  '.detail-block',
  '.sidebar-block',
  '.pane-card',
].join(', ');

const MAX_TILT = 6;
const LIFT     = -6;
const EDGE_PAD = 12;
const EASE_OUT = 'transform 0.55s cubic-bezier(0.23, 1, 0.32, 1), box-shadow 0.3s ease';

const cards = Array.from(document.querySelectorAll(TILT_SEL));

// Per-card state: stable rect (captured while untransformed) + active flag
const state = new Map(cards.map(c => [c, { rect: null, active: false, timer: null }]));

function captureRects() {
  cards.forEach(card => {
    const s = state.get(card);
    if (!s.active) s.rect = card.getBoundingClientRect();
  });
}

captureRects();
window.addEventListener('resize', captureRects);
window.addEventListener('scroll', captureRects, true);

document.addEventListener('mousemove', e => {
  const mx = e.clientX, my = e.clientY;

  cards.forEach(card => {
    const s = state.get(card);
    if (!s.rect) return;

    const { left, top, right, bottom, width, height } = s.rect;
    const inside = mx >= left && mx <= right && my >= top && my <= bottom;

    if (inside) {
      clearTimeout(s.timer);

      if (!s.active) {
        s.active = true;
        card.style.transition = 'border-color 0.3s, background 0.3s, box-shadow 0.3s';
      }

      const x  = Math.max(EDGE_PAD, Math.min(width  - EDGE_PAD, mx - left));
      const y  = Math.max(EDGE_PAD, Math.min(height - EDGE_PAD, my - top));
      const rx = ((y - height / 2) / (height / 2)) * -MAX_TILT;
      const ry = ((x - width  / 2) / (width  / 2)) *  MAX_TILT;

      card.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(${LIFT}px) scale(1.01)`;

    } else if (s.active) {
      s.active = false;
      s.timer = setTimeout(() => {
        card.style.transition = EASE_OUT;
        card.style.transform  = '';
        // Refresh rect after card springs back to natural position
        setTimeout(() => {
          card.style.transition = '';
          s.rect = card.getBoundingClientRect();
        }, 560);
      }, 20);
    }
  });
});

/* ── Tech stack spotlight grid ──────────────────────────── */
(function () {
  const grid = document.querySelector('.stack-grid');
  if (!grid) return;

  const items = Array.from(grid.querySelectorAll('.stack-item'));

  // Ambient spotlight follows cursor
  document.addEventListener('mousemove', e => {
    grid.style.setProperty('--spotlight-x', `${e.clientX}px`);
    grid.style.setProperty('--spotlight-y', `${e.clientY}px`);

    // Update per-card local glow position
    items.forEach(item => {
      const r = item.getBoundingClientRect();
      item.style.setProperty('--card-x', `${e.clientX - r.left}px`);
      item.style.setProperty('--card-y', `${e.clientY - r.top}px`);
    });
  });

  document.addEventListener('mouseleave', () => {
    grid.style.setProperty('--spotlight-x', '-9999px');
    grid.style.setProperty('--spotlight-y', '-9999px');
  });

  // Group-based highlighting on card hover
  function getGroups(item) {
    return new Set((item.dataset.group || '').split(' ').filter(Boolean));
  }

  function hasOverlap(setA, setB) {
    for (const g of setA) if (setB.has(g)) return true;
    return false;
  }

  function clearStates() {
    items.forEach(item => item.classList.remove('is-active', 'is-related', 'is-unrelated'));
  }

  items.forEach(item => {
    item.addEventListener('mouseenter', () => {
      const groups = getGroups(item);
      items.forEach(other => {
        if (other === item) {
          other.classList.add('is-active');
        } else if (hasOverlap(groups, getGroups(other))) {
          other.classList.add('is-related');
        } else {
          other.classList.add('is-unrelated');
        }
      });
    });

    item.addEventListener('mouseleave', clearStates);
  });
})();
