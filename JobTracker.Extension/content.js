// Keep the message channel open for async response by returning true.
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GET_JOB_DATA') {
    scrapeJobData().then(jobData => sendResponse({ jobData }));
  }
  return true;
});

async function scrapeJobData() {
  const url = window.location.href;
  if (url.includes('linkedin.com'))    return await scrapeLinkedIn();
  if (url.includes('indeed.com/cmp/')) return scrapeIndeedCmp();
  if (indeedVjk(url))                  return scrapeIndeedVjk();
  if (url.includes('indeed.com'))      return scrapeIndeed();
  if (url.includes('glassdoor.com'))   return scrapeGlassdoor();
  return null;
}

function indeedVjk(url) {
  try { return new URL(url).searchParams.has('vjk'); } catch { return false; }
}

// ── LinkedIn ────────────────────────────────────────────────────────────────

async function scrapeLinkedIn() {
  // Only proceed when a specific job is selected.
  // On the search results page this means currentJobId is present in the URL.
  try {
    const params = new URL(window.location.href).searchParams;
    const isView = window.location.pathname.includes('/jobs/view/');
    if (!params.has('currentJobId') && !isView) return null;
  } catch { return null; }

  // LinkedIn renders the right panel after the URL updates.
  // Poll until a title element appears (up to 6 seconds, every 300 ms).
  const TITLE_SELECTORS = [
    '.job-details-jobs-unified-top-card__job-title h1',
    '.jobs-unified-top-card__job-title h1',
    'h1.t-24.t-bold.inline',
    '.job-details-jobs-unified-top-card__job-title',
    '.jobs-unified-top-card__job-title',
    'h1.t-24',
  ];
  await waitForAny(TITLE_SELECTORS, 6000);

  // Title — try the h1 inside the container first; it avoids picking up
  // stale text from adjacent elements.
  const title =
    text('.job-details-jobs-unified-top-card__job-title h1')          ||
    text('.jobs-unified-top-card__job-title h1')                      ||
    text('h1.t-24.t-bold.inline')                                     ||
    text('h1.t-24')                                                   ||
    text('.job-details-jobs-unified-top-card__job-title')             ||
    text('.jobs-unified-top-card__job-title');

  // Company — anchor inside the element gives the cleanest text.
  const company =
    text('.job-details-jobs-unified-top-card__company-name a')        ||
    text('.job-details-jobs-unified-top-card__company-name')          ||
    text('.jobs-unified-top-card__company-name a')                    ||
    text('.jobs-unified-top-card__company-name')                      ||
    text('.topcard__org-name');

  // Location — LinkedIn orders bullets: location · work-type · posted date.
  // The first matching element is the location.
  const location =
    text('.job-details-jobs-unified-top-card__bullet')                ||
    text('.jobs-unified-top-card__bullet')                            ||
    text('.topcard__flavor--bullet')                                  ||
    text('.job-details-jobs-unified-top-card__primary-description-container .tvm__text');

  // Description — #job-details is the stable container ID since ~2023.
  const description =
    text('#job-details')                                              ||
    text('.jobs-description-content__text--stretch')                 ||
    text('.jobs-description-content__text')                          ||
    text('.jobs-description__content');

  return { title, company, location, description, url: window.location.href };
}

// Resolves once any selector in the list has non-empty innerText, or on timeout.
async function waitForAny(selectors, timeout) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    for (const sel of selectors) {
      if (document.querySelector(sel)?.innerText?.trim()) return;
    }
    await new Promise(r => setTimeout(r, 300));
  }
}

// ── Indeed (vjk panel) ──────────────────────────────────────────────────────

function scrapeIndeedVjk() {
  const panel = document.querySelector('.jobsearch-RightPane')               ||
                document.querySelector('[data-testid="right-pane"]')         ||
                document.querySelector('.jobsearch-ViewJobLayout-jobDisplay') ||
                document;

  const q = (sel) => panel.querySelector(sel)?.innerText?.trim() || '';

  return {
    title:       q('h2.jobTitle')                                            ||
                 q('[data-testid="jobsearch-JobInfoHeader-title"]')          ||
                 q('h1.jobsearch-JobInfoHeader-title'),
    company:     q('[data-testid="inlineHeader-companyName"]')               ||
                 q('.jobsearch-InlineCompanyRating-companyName'),
    location:    q('[data-testid="job-location"]')                          ||
                 q('.jobsearch-JobInfoHeader-subtitle'),
    description: q('#jobDescriptionText')                                    ||
                 q('.jobsearch-jobDescriptionText'),
    url:         window.location.href,
  };
}

// ── Indeed (company pages) ──────────────────────────────────────────────────

function scrapeIndeedCmp() {
  return {
    title:       text('[data-testid="jobsearch-JobInfoHeader-title"] span')  ||
                 text('[data-testid="jobsearch-JobInfoHeader-title"]')        ||
                 text('h1.jobsearch-JobInfoHeader-title')                     ||
                 text('h1[data-testid="simcta-job-title"]'),
    company:     text('[data-testid="inlineHeader-companyName"] a')           ||
                 text('[data-testid="inlineHeader-companyName"]')             ||
                 text('.jobsearch-InlineCompanyRating-companyName')           ||
                 text('[data-company-name="true"]'),
    location:    text('[data-testid="job-location"]')                        ||
                 text('.jobsearch-JobInfoHeader-subtitle [data-testid]')     ||
                 text('.css-6z8o9s'),
    description: text('#jobDescriptionText')                                 ||
                 text('.jobsearch-jobDescriptionText'),
    url:         window.location.href,
  };
}

// ── Indeed (standard) ───────────────────────────────────────────────────────

function scrapeIndeed() {
  return {
    title:       text('[data-testid="jobsearch-JobInfoHeader-title"]'),
    company:     text('[data-testid="inlineHeader-companyName"]'),
    location:    text('[data-testid="job-location"]'),
    description: text('#jobDescriptionText'),
    url:         window.location.href,
  };
}

// ── Glassdoor ───────────────────────────────────────────────────────────────

function scrapeGlassdoor() {
  return {
    title:       text('[data-test="job-title"]'),
    company:     text('[data-test="employer-name"]'),
    location:    text('[data-test="location"]'),
    description: text('.jobDescriptionContent'),
    url:         window.location.href,
  };
}

// ── Utility ─────────────────────────────────────────────────────────────────

function text(selector) {
  return document.querySelector(selector)?.innerText?.trim() || '';
}
