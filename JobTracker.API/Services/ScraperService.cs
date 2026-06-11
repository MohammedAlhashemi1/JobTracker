using HtmlAgilityPack;
using JobTracker.API.DTOs;

namespace JobTracker.API.Services;

public class ScraperService
{
    private readonly HttpClient _http;

    public ScraperService(HttpClient http)
    {
        _http = http;
    }

    public async Task<ScrapeResponseDto> ScrapeAsync(string url)
    {
        var html = await FetchHtmlAsync(url);
        var doc = new HtmlDocument();
        doc.LoadHtml(html);

        var result = new ScrapeResponseDto { Url = url };

        if (url.Contains("linkedin.com"))
            ParseLinkedIn(doc, result);
        else if (url.Contains("indeed.com"))
            ParseIndeed(doc, result);
        else if (url.Contains("glassdoor.com"))
            ParseGlassdoor(doc, result);

        // Fill any blanks from Open Graph / meta tags as fallback
        if (string.IsNullOrWhiteSpace(result.JobTitle))
            result.JobTitle = GetMeta(doc, "og:title") ?? GetMeta(doc, "title");
        if (string.IsNullOrWhiteSpace(result.Company))
            result.Company = GetMeta(doc, "og:site_name");
        if (string.IsNullOrWhiteSpace(result.JobDescription))
            result.JobDescription = GetMeta(doc, "og:description") ?? GetMeta(doc, "description");

        return result;
    }

    private void ParseLinkedIn(HtmlDocument doc, ScrapeResponseDto result)
    {
        result.JobTitle = InnerText(doc, "//*[contains(@class,'job-details-jobs-unified-top-card__job-title')]");
        result.Company = InnerText(doc, "//*[contains(@class,'job-details-jobs-unified-top-card__company-name')]");
        result.Location = InnerText(doc, "//*[contains(@class,'job-details-jobs-unified-top-card__bullet')]");
        result.JobDescription = InnerText(doc, "//*[contains(@class,'jobs-description__content')]");
    }

    private void ParseIndeed(HtmlDocument doc, ScrapeResponseDto result)
    {
        result.JobTitle = InnerText(doc, "//*[@data-testid='jobsearch-JobInfoHeader-title']");
        result.Company = InnerText(doc, "//*[@data-testid='inlineHeader-companyName']");
        result.Location = InnerText(doc, "//*[@data-testid='job-location']");
        result.JobDescription = InnerText(doc, "//*[@id='jobDescriptionText']");
    }

    private void ParseGlassdoor(HtmlDocument doc, ScrapeResponseDto result)
    {
        result.JobTitle = InnerText(doc, "//*[@data-test='job-title']");
        result.Company = InnerText(doc, "//*[@data-test='employer-name']");
        result.Location = InnerText(doc, "//*[@data-test='location']");
        result.JobDescription = InnerText(doc, "//*[contains(@class,'jobDescriptionContent')]");
    }

    private static string? InnerText(HtmlDocument doc, string xpath)
    {
        var node = doc.DocumentNode.SelectSingleNode(xpath);
        if (node is null) return null;
        var text = HtmlEntity.DeEntitize(node.InnerText).Trim();
        return string.IsNullOrWhiteSpace(text) ? null : text;
    }

    private static string? GetMeta(HtmlDocument doc, string name)
    {
        // og: properties use property attribute; regular meta use name attribute
        var node = doc.DocumentNode.SelectSingleNode(
            $"//meta[@property='{name}' or @name='{name}']");
        var content = node?.GetAttributeValue("content", null)?.Trim();
        return string.IsNullOrWhiteSpace(content) ? null : content;
    }

    private async Task<string> FetchHtmlAsync(string url)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, url);
        // Mimic a real browser to avoid basic bot-detection rejections
        request.Headers.Add("User-Agent",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
            "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36");
        request.Headers.Add("Accept-Language", "en-US,en;q=0.9");

        var response = await _http.SendAsync(request);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadAsStringAsync();
    }
}
