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
  // Guard: only proceed when a specific job is selected in the panel.
  try {
    const params  = new URL(window.location.href).searchParams;
    const isView  = window.location.pathname.includes('/jobs/view/');
    if (!params.has('currentJobId') && !isView) return null;
  } catch { return null; }

  // If this content script is running *inside* an iframe (all_frames: true
  // and the iframe URL matches the pattern), scrape this document directly.
  if (window !== window.top) {
    await waitForEl('h1', document, 6000);
    return scrapeLinkedInDoc(document);
  }

  // Main frame: the job detail panel lives inside one of the page's iframes.
  // Poll until an iframe contains an h1 (the job title).
  await waitForJobIframe(6000);

  for (const iframe of document.querySelectorAll('iframe')) {
    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc?.querySelector('h1')?.innerText?.trim()) continue;
      return scrapeLinkedInDoc(doc);
    } catch {
      // Cross-origin iframe — skip silently.
      continue;
    }
  }

  return null;
}

// Scrape the four job fields from any Document object (main doc or iframe doc).
function scrapeLinkedInDoc(doc) {
  const t = (sel) => doc.querySelector(sel)?.innerText?.trim() || '';

  // Title: h1 is reliable regardless of surrounding class names.
  const title =
    t('.job-details-jobs-unified-top-card__job-title h1') ||
    t('.jobs-unified-top-card__job-title h1')             ||
    t('h1');

  // Company: try the stable class names, then a broad substring match.
  const company =
    t('.job-details-jobs-unified-top-card__company-name a') ||
    t('.job-details-jobs-unified-top-card__company-name')   ||
    t('.jobs-unified-top-card__company-name a')             ||
    t('.jobs-unified-top-card__company-name')               ||
    t('[class*="company-name"] a')                          ||
    t('[class*="company-name"]');

  // Location: first bullet span — LinkedIn orders them location · type · date.
  const location =
    t('.job-details-jobs-unified-top-card__bullet') ||
    t('.jobs-unified-top-card__bullet')             ||
    t('[class*="topcard__flavor--bullet"]')         ||
    t('[class*="bullet"]');

  // Description: #job-details is the stable ID since the 2023 redesign.
  const description =
    t('#job-details')                              ||
    t('.jobs-description-content__text--stretch') ||
    t('.jobs-description-content__text')          ||
    t('.jobs-description__content');

  return { title, company, location, description, url: window.location.href };
}

// Poll until any iframe's document contains a non-empty h1, or timeout.
async function waitForJobIframe(timeout) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    for (const iframe of document.querySelectorAll('iframe')) {
      try {
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (doc?.querySelector('h1')?.innerText?.trim()) return;
      } catch {}
    }
    await sleep(300);
  }
}

// Poll until selector exists with non-empty text in a given document, or timeout.
async function waitForEl(selector, doc, timeout) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (doc.querySelector(selector)?.innerText?.trim()) return;
    await sleep(300);
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
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
