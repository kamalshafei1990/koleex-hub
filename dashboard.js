/* ============================================================
   KOLEEX Dashboard — Logic
   ============================================================ */

// ── State ──
let currentTheme = localStorage.getItem('koleex-theme') || 'light';
let currentLang = localStorage.getItem('koleex-lang') || 'en';
let sidebarOpen = false;

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ── Init ──
document.addEventListener('DOMContentLoaded', () => {
  applyTheme(currentTheme);
  applyLanguage(currentLang);
  initThemeToggle();
  initLanguagePill();
  initSidebar();
  initPeriodToggle();
  updateGreeting();
  updateDate();
  renderKPIs();
  renderRevenueChart();
  renderOrdersChart();
  renderOrderStatus();
  renderTopProducts();
  renderQuickActions();
  renderActivity();
  renderUpcoming();
});

// ── Theme ──
function applyTheme(theme) {
  currentTheme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('koleex-theme', theme);
}
function initThemeToggle() {
  $('#themeToggle').addEventListener('click', () => {
    applyTheme(currentTheme === 'light' ? 'dark' : 'light');
    // Re-render charts for theme colors
    renderRevenueChart();
    renderOrdersChart();
  });
}

// ── Language ──
function applyLanguage(lang) {
  currentLang = lang;
  document.documentElement.setAttribute('lang', lang);
  document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
  localStorage.setItem('koleex-lang', lang);
}
function initLanguagePill() {
  const pill = $('#langPill');
  const options = pill.querySelectorAll('.lang-option');
  const indicator = pill.querySelector('.lang-indicator');
  function updateIndicator() {
    const active = pill.querySelector('.lang-option.active');
    if (active && indicator) {
      indicator.style.width = active.offsetWidth + 'px';
      indicator.style.left = active.offsetLeft + 'px';
    }
  }
  options.forEach(opt => {
    if (opt.dataset.lang === currentLang) { opt.classList.add('active'); opt.setAttribute('aria-checked','true'); }
    else { opt.classList.remove('active'); opt.setAttribute('aria-checked','false'); }
  });
  requestAnimationFrame(() => requestAnimationFrame(updateIndicator));
  options.forEach(opt => {
    opt.addEventListener('click', () => {
      options.forEach(o => { o.classList.remove('active'); o.setAttribute('aria-checked','false'); });
      opt.classList.add('active');
      opt.setAttribute('aria-checked','true');
      updateIndicator();
      applyLanguage(opt.dataset.lang);
    });
  });
  window.addEventListener('resize', updateIndicator);
}

// ── Sidebar ──
function initSidebar() {
  const toggle = $('#sidebarToggle');
  const sidebar = $('#sidebar');
  const overlay = $('#sidebarOverlay');
  toggle.addEventListener('click', () => {
    sidebarOpen = !sidebarOpen;
    sidebar.classList.toggle('open', sidebarOpen);
    overlay.classList.toggle('active', sidebarOpen);
    document.body.style.overflow = sidebarOpen ? 'hidden' : '';
  });
  overlay.addEventListener('click', () => {
    sidebarOpen = false;
    sidebar.classList.remove('open');
    overlay.classList.remove('active');
    document.body.style.overflow = '';
  });
}

// ── Period Toggle ──
function initPeriodToggle() {
  $$('.period-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.period-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
}

// ── Greeting ──
function updateGreeting() {
  const hour = new Date().getHours();
  let greeting;
  if (hour < 12) greeting = 'Good morning';
  else if (hour < 17) greeting = 'Good afternoon';
  else greeting = 'Good evening';
  const el = $('#dashGreeting');
  if (el) el.textContent = `${greeting}, Kamal`;
}

// ── Date ──
function updateDate() {
  const el = $('#dashDate');
  if (!el) return;
  const now = new Date();
  el.textContent = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

// ── KPI Cards ──
function renderKPIs() {
  const kpis = [
    { label: 'Revenue', value: '$248,520', change: '+12.5%', dir: 'up', icon: 'dollar' },
    { label: 'Orders', value: '1,284', change: '+8.2%', dir: 'up', icon: 'cart' },
    { label: 'Customers', value: '3,642', change: '+4.1%', dir: 'up', icon: 'users' },
    { label: 'Avg. Order', value: '$193.50', change: '-2.3%', dir: 'down', icon: 'receipt' },
  ];

  const icons = {
    dollar: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="8" y1="1" x2="8" y2="15"/><path d="M11 4H6.5a2.5 2.5 0 0 0 0 5h3a2.5 2.5 0 0 1 0 5H5"/></svg>`,
    cart: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="14" r="1"/><circle cx="13" cy="14" r="1"/><path d="M1 1h2.5l1.8 9a1.5 1.5 0 0 0 1.5 1.1h6.4a1.5 1.5 0 0 0 1.5-1.1L16 4H4.5"/></svg>`,
    users: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="5" r="3"/><path d="M2 15v-1a4 4 0 0 1 8 0v1"/><path d="M11 2.13a3 3 0 0 1 0 5.75"/><path d="M14 15v-1a3 3 0 0 0-2-2.83"/></svg>`,
    receipt: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="2" y="1" width="12" height="14" rx="1"/><line x1="5" y1="5" x2="11" y2="5"/><line x1="5" y1="8" x2="9" y2="8"/><line x1="5" y1="11" x2="8" y2="11"/></svg>`,
  };

  const arrowUp = `<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V3"/><path d="M3 5l3-3 3 3"/></svg>`;
  const arrowDown = `<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3v6"/><path d="M3 7l3 3 3-3"/></svg>`;

  const grid = $('#kpiGrid');
  grid.innerHTML = kpis.map(kpi => `
    <div class="kpi-card">
      <div class="kpi-top">
        <span class="kpi-label">${kpi.label}</span>
        <div class="kpi-icon">${icons[kpi.icon]}</div>
      </div>
      <span class="kpi-value">${kpi.value}</span>
      <span class="kpi-change kpi-change--${kpi.dir}">
        ${kpi.dir === 'up' ? arrowUp : arrowDown}
        ${kpi.change} vs last period
      </span>
    </div>
  `).join('');
}

// ── Revenue Chart ──
function renderRevenueChart() {
  const data = [18200, 22400, 19800, 28500, 24100, 31200, 27600, 35400, 29800, 33100, 38200, 42500];
  const labels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  renderLineChart('revenueChart', data, labels);
}

function renderOrdersChart() {
  const data = [82, 96, 78, 115, 104, 128, 112, 142, 125, 138, 156, 168];
  const labels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  renderLineChart('ordersChart', data, labels);
}

function renderLineChart(containerId, data, labels) {
  const container = $(`#${containerId}`);
  const w = 100; // viewBox percentage
  const h = 100;
  const padL = 0, padR = 0, padT = 8, padB = 16;
  const chartW = w - padL - padR;
  const chartH = h - padT - padB;

  const max = Math.max(...data) * 1.1;
  const min = Math.min(...data) * 0.9;
  const range = max - min;

  const points = data.map((d, i) => {
    const x = padL + (i / (data.length - 1)) * chartW;
    const y = padT + chartH - ((d - min) / range) * chartH;
    return { x, y };
  });

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
  const areaD = pathD + ` L${points[points.length-1].x.toFixed(2)},${padT + chartH} L${points[0].x.toFixed(2)},${padT + chartH} Z`;

  // Grid lines
  const gridCount = 4;
  let gridLines = '';
  for (let i = 0; i <= gridCount; i++) {
    const y = padT + (i / gridCount) * chartH;
    gridLines += `<line x1="${padL}" y1="${y}" x2="${w}" y2="${y}" class="chart-grid-line"/>`;
  }

  // Labels
  const labelEls = labels.filter((_, i) => i % 2 === 0 || i === labels.length - 1).map((label, idx, arr) => {
    const origIdx = labels.indexOf(label);
    const x = padL + (origIdx / (data.length - 1)) * chartW;
    return `<text x="${x}" y="${h - 2}" text-anchor="middle" class="chart-label">${label}</text>`;
  }).join('');

  // Last dot
  const lastP = points[points.length - 1];

  container.innerHTML = `
    <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
      ${gridLines}
      <path d="${areaD}" class="chart-area"/>
      <path d="${pathD}" class="chart-line"/>
      <circle cx="${lastP.x.toFixed(2)}" cy="${lastP.y.toFixed(2)}" r="2.5" class="chart-dot"/>
      ${labelEls}
    </svg>
  `;
}

// ── Order Status ──
function renderOrderStatus() {
  const statuses = [
    { label: 'Completed', count: 842, pct: 65, status: 'completed' },
    { label: 'Processing', count: 256, pct: 20, status: 'processing' },
    { label: 'Pending', count: 143, pct: 11, status: 'pending' },
    { label: 'Cancelled', count: 43, pct: 4, status: 'cancelled' },
  ];

  $('#orderStatus').innerHTML = statuses.map(s => `
    <div class="status-item">
      <div class="status-left">
        <span class="status-dot status-dot--${s.status}"></span>
        <span class="status-label">${s.label}</span>
      </div>
      <div class="status-right">
        <span class="status-count">${s.count}</span>
        <div class="status-bar-bg">
          <div class="status-bar-fill" style="width: ${s.pct}%"></div>
        </div>
      </div>
    </div>
  `).join('');
}

// ── Top Products ──
function renderTopProducts() {
  const products = [
    { name: 'Industrial Sensor Module', sku: 'ISM-4200', revenue: '$42,180' },
    { name: 'Control Board V3', sku: 'CB-V300', revenue: '$38,450' },
    { name: 'Precision Actuator', sku: 'PA-1100', revenue: '$31,200' },
    { name: 'Network Gateway', sku: 'NG-8800', revenue: '$28,900' },
    { name: 'Power Distribution Unit', sku: 'PDU-500', revenue: '$24,350' },
  ];

  $('#topProducts').innerHTML = products.map((p, i) => `
    <div class="product-item">
      <div class="product-left">
        <span class="product-rank">${i + 1}</span>
        <div class="product-info">
          <span class="product-name">${p.name}</span>
          <span class="product-sku">${p.sku}</span>
        </div>
      </div>
      <span class="product-revenue">${p.revenue}</span>
    </div>
  `).join('');
}

// ── Quick Actions ──
function renderQuickActions() {
  const actions = [
    { label: 'New Order', icon: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="8" y1="3" x2="8" y2="13"/><line x1="3" y1="8" x2="13" y2="8"/></svg>` },
    { label: 'Invoice', icon: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V5z"/><polyline points="10 2 10 5 13 5"/></svg>` },
    { label: 'Add Product', icon: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 10V6a1 1 0 0 0-.5-1L8.5 2a1 1 0 0 0-1 0L2.5 5A1 1 0 0 0 2 6v4a1 1 0 0 0 .5 1l5 3a1 1 0 0 0 1 0l5-3a1 1 0 0 0 .5-1z"/></svg>` },
    { label: 'Contact', icon: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="5" r="3"/><path d="M3 15v-1a5 5 0 0 1 10 0v1"/></svg>` },
    { label: 'Report', icon: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="12" x2="12" y2="6"/><line x1="8" y1="12" x2="8" y2="3"/><line x1="4" y1="12" x2="4" y2="9"/></svg>` },
    { label: 'Export', icon: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v1a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-1"/><polyline points="5 6 8 3 11 6"/><line x1="8" y1="3" x2="8" y2="11"/></svg>` },
  ];

  $('#quickActions').innerHTML = actions.map(a => `
    <button class="action-btn">${a.icon}<span>${a.label}</span></button>
  `).join('');
}

// ── Activity ──
function renderActivity() {
  const items = [
    { text: '<strong>Order #4821</strong> was completed and shipped to client', time: '12 min ago' },
    { text: '<strong>Sarah Chen</strong> approved quotation QT-2024-089', time: '34 min ago' },
    { text: 'New customer <strong>Meridian Industries</strong> registered', time: '1 hour ago' },
    { text: '<strong>Invoice INV-3847</strong> payment received — $18,400', time: '2 hours ago' },
    { text: 'Inventory alert: <strong>Control Board V3</strong> below threshold', time: '3 hours ago' },
    { text: '<strong>Project Nexus</strong> milestone updated to Phase 3', time: '4 hours ago' },
  ];

  $('#activityList').innerHTML = items.map(item => `
    <div class="activity-item">
      <span class="activity-dot"></span>
      <div class="activity-content">
        <p class="activity-text">${item.text}</p>
        <span class="activity-time">${item.time}</span>
      </div>
    </div>
  `).join('');
}

// ── Upcoming ──
function renderUpcoming() {
  const now = new Date();
  const items = [
    { day: now.getDate(), month: 'Mar', title: 'Q1 Revenue Review', desc: 'Finance team sync', time: '10:00 AM' },
    { day: now.getDate() + 1, month: 'Mar', title: 'Client Call — Meridian', desc: 'Product demo & pricing', time: '2:30 PM' },
    { day: now.getDate() + 2, month: 'Mar', title: 'Supply Chain Meeting', desc: 'Logistics optimization', time: '9:00 AM' },
    { day: now.getDate() + 3, month: 'Mar', title: 'Team Standup', desc: 'Weekly planning', time: '11:00 AM' },
    { day: now.getDate() + 5, month: 'Apr', title: 'Board Presentation', desc: 'Q1 results & Q2 roadmap', time: '3:00 PM' },
  ];

  $('#upcomingList').innerHTML = items.map(item => `
    <div class="upcoming-item">
      <div class="upcoming-date">
        <span class="upcoming-day">${item.day}</span>
        <span class="upcoming-month">${item.month}</span>
      </div>
      <div class="upcoming-content">
        <span class="upcoming-title">${item.title}</span>
        <span class="upcoming-desc">${item.desc}</span>
      </div>
      <span class="upcoming-time-badge">${item.time}</span>
    </div>
  `).join('');
}
