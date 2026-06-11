chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GET_JOB_DATA') {
    sendResponse({ jobData: scrapeJobData() });
  }
  return true;
});

function scrapeJobData() {
  const url = window.location.href;
  if (url.includes('linkedin.com'))   return scrapeLinkedIn();
  if (url.includes('indeed.com'))     return scrapeIndeed();
  if (url.includes('glassdoor.com'))  return scrapeGlassdoor();
  return null;
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
