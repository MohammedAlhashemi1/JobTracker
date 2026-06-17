chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GET_JOB_DATA') {
    sendResponse({ jobData: scrapeJobData() });
  }
  return true;
});

function scrapeJobData() {
  const url = window.location.href;
  if (url.includes('linkedin.com'))    return scrapeLinkedIn();
  if (url.includes('indeed.com/cmp/')) return scrapeIndeedCmp();
  if (indeedVjk(url))                  return scrapeIndeedVjk();
  if (url.includes('indeed.com'))      return scrapeIndeed();
  if (url.includes('glassdoor.com'))   return scrapeGlassdoor();
  return null;
}

function indeedVjk(url) {
  try { return new URL(url).searchParams.has('vjk'); } catch { return false; }
}

function scrapeLinkedIn() {
  return {
    title:       text('.job-details-jobs-unified-top-card__job-title'),
    company:     text('.job-details-jobs-unified-top-card__company-name'),
    location:    text('.job-details-jobs-unified-top-card__bullet'),
    description: text('.jobs-description__content'),
    url:         window.location.href,
  };
}

function scrapeIndeedVjk() {
  // ca.indeed.com/?vjk=... — job detail loads in the right panel
  const panel = document.querySelector('.jobsearch-RightPane')             ||
                document.querySelector('[data-testid="right-pane"]')       ||
                document.querySelector('.jobsearch-ViewJobLayout-jobDisplay') ||
                document;

  const q = (sel) => panel.querySelector(sel)?.innerText?.trim() || '';

  return {
    title:       q('h2.jobTitle')                                          ||
                 q('[data-testid="jobsearch-JobInfoHeader-title"]')        ||
                 q('h1.jobsearch-JobInfoHeader-title'),
    company:     q('[data-testid="inlineHeader-companyName"]')             ||
                 q('.jobsearch-InlineCompanyRating-companyName'),
    location:    q('[data-testid="job-location"]')                        ||
                 q('.jobsearch-JobInfoHeader-subtitle'),
    description: q('#jobDescriptionText')                                  ||
                 q('.jobsearch-jobDescriptionText'),
    url:         window.location.href,
  };
}

function scrapeIndeedCmp() {
  // Job detail side panel on ca.indeed.com/cmp/* company pages
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

function scrapeIndeed() {
  return {
    title:       text('[data-testid="jobsearch-JobInfoHeader-title"]'),
    company:     text('[data-testid="inlineHeader-companyName"]'),
    location:    text('[data-testid="job-location"]'),
    description: text('#jobDescriptionText'),
    url:         window.location.href,
  };
}

function scrapeGlassdoor() {
  return {
    title:       text('[data-test="job-title"]'),
    company:     text('[data-test="employer-name"]'),
    location:    text('[data-test="location"]'),
    description: text('.jobDescriptionContent'),
    url:         window.location.href,
  };
}

function text(selector) {
  return document.querySelector(selector)?.innerText?.trim() || '';
}
