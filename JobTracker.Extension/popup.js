const API = 'http://localhost:5220/api';

const SUPPORTED = [
  'linkedin.com/jobs/',
  'indeed.com/viewjob',
  'indeed.com/cmp/',
  'glassdoor.com/job-listing/',
];

function isSupported(url) {
  if (SUPPORTED.some((s) => url.includes(s))) return true;
  try {
    const u = new URL(url);
    if (u.hostname.includes('indeed.com') && u.searchParams.has('vjk')) return true;
  } catch {}
  return false;
}

function isLinkedIn(url) {
  return url.includes('linkedin.com/jobs/');
}

// ── DOM refs ──────────────────────────────────────────────────────────────

const $ = (id) => document.getElementById(id);

const views = {
  login:       $('login-view'),
  auth:        $('auth-view'),
  loading:     $('view-loading'),
  unsupported: $('view-unsupported'),
  nodata:      $('view-nodata'),
  job:         $('view-job'),
  manual:      $('view-manual'),
  success:     $('view-success'),
};

// ── helpers ────────────────────────────────────────────────────────────────

function showOnly(...activeViews) {
  Object.values(views).forEach((v) => v.classList.add('hidden'));
  activeViews.forEach((v) => v && v.classList.remove('hidden'));
}

function setError(el, msg) {
  el.textContent = msg;
  el.classList.remove('hidden');
}

function clearError(el) {
  el.textContent = '';
  el.classList.add('hidden');
}

// ── init ───────────────────────────────────────────────────────────────────

chrome.storage.local.get(['token', 'fullName'], ({ token, fullName }) => {
  if (!token) {
    showOnly(views.login);
  } else {
    enterAuthView(token, fullName);
  }
});

// ── login ──────────────────────────────────────────────────────────────────

$('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const loginBtn = $('login-btn');
  const errorEl  = $('login-error');
  clearError(errorEl);
  loginBtn.disabled = true;
  loginBtn.textContent = 'Signing in…';

  const email    = $('email').value.trim();
  const password = $('password').value;

  try {
    const res  = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Login failed.');

    await chrome.storage.local.set({ token: data.token, fullName: data.fullName });
    enterAuthView(data.token, data.fullName);
  } catch (err) {
    setError(errorEl, err.message || 'Invalid email or password.');
    loginBtn.disabled = false;
    loginBtn.textContent = 'Sign in';
  }
});

// ── logout ─────────────────────────────────────────────────────────────────

$('logout-btn').addEventListener('click', async () => {
  await chrome.storage.local.remove(['token', 'fullName']);
  $('user-row').classList.add('hidden');
  showOnly(views.login);
  $('login-btn').disabled = false;
  $('login-btn').textContent = 'Sign in';
  $('email').value = '';
  $('password').value = '';
});

// ── authenticated view ─────────────────────────────────────────────────────

let currentJobData = null;
let manualUrl = '';

async function enterAuthView(token, fullName) {
  $('user-row').classList.remove('hidden');
  $('user-name').textContent = fullName || '';

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url || '';

  if (!isSupported(url)) {
    showOnly(views.auth, views.unsupported);
    return;
  }

  // LinkedIn: never scrape — show the manual entry form instead.
  if (isLinkedIn(url)) {
    manualUrl = url;
    $('m-title').value    = '';
    $('m-company').value  = '';
    $('m-location').value = '';
    $('m-desc').value     = '';
    clearError($('manual-log-error'));
    $('manual-log-btn').disabled = false;
    $('manual-log-btn').textContent = 'Log Application';
    showOnly(views.auth, views.manual);
    return;
  }

  // Indeed / Glassdoor: auto-scrape via content script.
  showOnly(views.auth, views.loading);
  try {
    const response = await sendMessageToTab(tab.id, { type: 'GET_JOB_DATA' });
    const job = response?.jobData;

    if (!job || (!job.title && !job.company)) {
      showOnly(views.auth, views.nodata);
      return;
    }

    currentJobData = job;
    $('job-title').textContent    = job.title    || '(no title)';
    $('job-company').textContent  = job.company  || '—';
    $('job-location').textContent = job.location || '—';
    showOnly(views.auth, views.job);
  } catch {
    showOnly(views.auth, views.nodata);
  }
}

function sendMessageToTab(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
      else resolve(response);
    });
  });
}

// ── log application (auto-scraped) ────────────────────────────────────────

$('log-btn').addEventListener('click', async () => {
  const logBtn  = $('log-btn');
  const errorEl = $('log-error');
  clearError(errorEl);
  logBtn.disabled = true;
  logBtn.textContent = 'Logging…';

  const { token } = await chrome.storage.local.get('token');

  try {
    const res = await fetch(`${API}/applications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        jobTitle:       currentJobData.title       || '',
        company:        currentJobData.company     || '',
        location:       currentJobData.location    || '',
        jobUrl:         currentJobData.url         || '',
        jobDescription: currentJobData.description || '',
      }),
    });

    if (res.status === 401) {
      await chrome.storage.local.remove(['token', 'fullName']);
      showOnly(views.login);
      return;
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to log application.');
    }

    $('success-detail').textContent =
      `${currentJobData.title || 'Role'} at ${currentJobData.company || 'Company'}`;
    showOnly(views.auth, views.success);
  } catch (err) {
    setError(errorEl, err.message || 'Something went wrong.');
    logBtn.disabled = false;
    logBtn.textContent = 'Log Application';
  }
});

// ── log application (LinkedIn manual entry) ────────────────────────────────

$('manual-log-btn').addEventListener('click', async () => {
  const btn     = $('manual-log-btn');
  const errorEl = $('manual-log-error');
  clearError(errorEl);

  const title   = $('m-title').value.trim();
  const company = $('m-company').value.trim();

  if (!title || !company) {
    setError(errorEl, 'Job Title and Company are required.');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Logging…';

  const { token } = await chrome.storage.local.get('token');

  try {
    const res = await fetch(`${API}/applications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        jobTitle:       title,
        company:        company,
        location:       $('m-location').value.trim(),
        jobUrl:         manualUrl,
        jobDescription: $('m-desc').value.trim(),
      }),
    });

    if (res.status === 401) {
      await chrome.storage.local.remove(['token', 'fullName']);
      showOnly(views.login);
      return;
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to log application.');
    }

    $('success-detail').textContent = `${title} at ${company}`;
    showOnly(views.auth, views.success);
  } catch (err) {
    setError(errorEl, err.message || 'Something went wrong.');
    btn.disabled = false;
    btn.textContent = 'Log Application';
  }
});

// ── log another ────────────────────────────────────────────────────────────

$('log-another-btn').addEventListener('click', async () => {
  currentJobData = null;
  const { token, fullName } = await chrome.storage.local.get(['token', 'fullName']);
  enterAuthView(token, fullName);
});
