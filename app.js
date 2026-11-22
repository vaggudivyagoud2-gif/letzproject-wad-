// ---------------------------------------------------------------------------
// Attendance dashboard
// ---------------------------------------------------------------------------

// ---------- Small DOM helpers ----------
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

// ---------- App state ----------
let students = [];
let subjects = [];
let currentFilter = 'all';   // used by the alerts table: 'all' | 'safe' | 'warning' | 'critical'
let rosterStatuses = {};     // studentId -> 'present' | 'absent' | 'late' (manual changes only)

// Minimum attendance required (75%)
const REQUIRED_ATTENDANCE = 0.75;

// ---------- Formatting helpers ----------

// "Ravi Kumar" -> "RK"
function getInitials(name) {
  return name
    .split(' ')
    .map((word) => word[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

// 'safe' -> 'Safe', 'warning' -> 'Warning', anything else -> 'Critical'
function getTierLabel(tier) {
  if (tier === 'safe') return 'Safe';
  if (tier === 'warning') return 'Warning';
  return 'Critical';
}

function riskBadge(tier) {
  return `<span class="risk-badge risk-${tier}">${getTierLabel(tier)}</span>`;
}

function studentCell(student) {
  return `
    <div class="student-cell">
      <span class="student-initial">${getInitials(student.name)}</span>
      <span>
        <b>${student.name}</b>
        <small>${student.branch} • ${student.year}</small>
      </span>
    </div>`;
}

// How many consecutive classes a student must attend to get back to 75%.
// Solves: (attended + x) / (held + x) >= 0.75   ->   x >= (0.75*held - attended) / 0.25
function classesNeededToRecover(held, attended) {
  const needed = Math.ceil((REQUIRED_ATTENDANCE * held - attended) / (1 - REQUIRED_ATTENDANCE));
  return Math.max(0, needed);
}

function progressBar(percentage, risk) {
  return `<span class="mini-progress ${risk}"><i style="width:${percentage}%"></i></span>`;
}

// ---------- Toast notification ----------
function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2800);
}

// ---------- API helper ----------
async function api(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }
  return data;
}

// ---------- Loading data ----------
async function load() {
  try {
    const data = await api('/api/overview');
    students = data.students;
    subjects = data.subjects;
    renderAll(data);
  } catch (error) {
    toast('Could not load data: ' + error.message);
  }
}

// ---------- Render everything ----------
function renderAll(data) {
  // Top stat cards
  $('#stat-total').textContent = data.totalStudents;
  $('#stat-safe').textContent = data.counts.safe;
  $('#stat-warning').textContent = data.counts.warning;
  $('#stat-critical').textContent = data.counts.critical;
  $('#nav-alert-count').textContent = data.counts.critical + data.counts.warning;

  // Sections
  populateSelects();
  renderRiskTable();
  renderStudents();
  renderAlerts();
  renderRoster();
  renderPortal();

  // Charts
  drawRiskChart(data.counts);
  drawCorrelation();

  // Today's date in the header
  $('#today').textContent = new Date().toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// ---------- Dashboard: 5 lowest-attendance students ----------
function renderRiskTable() {
  const lowestFive = [...students]
    .sort((a, b) => a.percentage - b.percentage)
    .slice(0, 5);

  $('#dashboard-risk-table').innerHTML = lowestFive
    .map((s) => `
      <tr>
        <td>${studentCell(s)}</td>
        <td>${s.rollNo}</td>
        <td>${progressBar(s.percentage, s.risk)}${s.percentage}%</td>
        <td>${classesNeededToRecover(s.held, s.attended)}</td>
        <td>${riskBadge(s.risk)}</td>
        <td><button class="table-action" data-mentor="${s.id}">Mentor →</button></td>
      </tr>`)
    .join('');
}

// ---------- Students page (searchable) ----------
function renderStudents() {
  const query = ($('#student-search')?.value || '').toLowerCase();

  const matches = students.filter((s) =>
    (s.name + s.rollNo).toLowerCase().includes(query)
  );

  $('#students-table').innerHTML = matches
    .map((s) => `
      <tr>
        <td>${studentCell(s)}</td>
        <td>${s.rollNo}</td>
        <td>${s.attended} / ${s.held}</td>
        <td><b>${s.percentage}%</b></td>
        <td>${riskBadge(s.risk)}</td>
        <td><button class="table-action" data-detail="${s.id}">View details →</button></td>
      </tr>`)
    .join('');
}

// ---------- Alerts page (filtered by risk, lowest first) ----------
function renderAlerts() {
  const filtered = students
    .filter((s) => currentFilter === 'all' || s.risk === currentFilter)
    .sort((a, b) => a.percentage - b.percentage);

  $('#alerts-table').innerHTML = filtered
    .map((s) => {
      const recoveryText =
        s.risk === 'safe'
          ? 'No recovery needed'
          : `${classesNeededToRecover(s.held, s.attended)} classes`;

      return `
        <tr>
          <td>${studentCell(s)}</td>
          <td>
            <b>${s.percentage}%</b>
            <div class="mini-progress ${s.risk}"><i style="width:${s.percentage}%"></i></div>
          </td>
          <td>${riskBadge(s.risk)}</td>
          <td>${recoveryText}</td>
          <td><button class="table-action" data-mentor="${s.id}">Log intervention →</button></td>
        </tr>`;
    })
    .join('');
}

// ---------- Attendance roster (mark present / absent / late) ----------
function renderRoster() {
  const selectedSubject = $('#attendance-subject').value || subjects[0];
  const query = ($('#roster-search')?.value || '').toLowerCase();

  const matches = students.filter((s) =>
    (s.name + s.rollNo).toLowerCase().includes(query)
  );

  $('#roster-count').textContent = matches.length;

  $('#roster-table').innerHTML = matches
    .map((s) => {
      const subjectRecord = s.subjects.find((x) => x.subject === selectedSubject);
      const subjectPercentage = subjectRecord?.percentage ?? 0;
      const status = rosterStatuses[s.id] || 'present';

      return `
        <tr>
          <td>${studentCell(s)}</td>
          <td>${s.rollNo}</td>
          <td>${subjectPercentage}%</td>
          <td>
            <select class="status-select" data-status="${s.id}">
              <option value="present" ${status === 'present' ? 'selected' : ''}>Present</option>
              <option value="absent"  ${status === 'absent'  ? 'selected' : ''}>Absent</option>
              <option value="late"    ${status === 'late'    ? 'selected' : ''}>Late</option>
            </select>
          </td>
        </tr>`;
    })
    .join('');

  $('#attendance-selection').textContent =
    `${students.length} students in roster • ${Object.keys(rosterStatuses).length} manually updated`;
}


