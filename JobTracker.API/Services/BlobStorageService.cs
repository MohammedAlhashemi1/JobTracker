using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;

namespace JobTracker.API.Services;

public interface IBlobStorageService
{
    bool IsEnabled { get; }
    Task<string> UploadResumeAsync(byte[] bytes, string fileName, string contentType, int userId);
    Task<(byte[] Bytes, string ContentType)> DownloadResumeAsync(string blobUrl);
    bool IsBlobUrl(string? url);
}

public class BlobStorageService : IBlobStorageService
{
    private readonly BlobServiceClient? _serviceClient;
    private readonly string _containerName;

    public bool IsEnabled => _serviceClient is not null;

    public BlobStorageService(IConfiguration config, ILogger<BlobStorageService> logger)
    {
        _containerName = config["AzureStorage:ContainerName"] ?? "resumes";

        var connectionString = config["AzureStorage:ConnectionString"];

        if (string.IsNullOrWhiteSpace(connectionString) ||
            connectionString.StartsWith("PLACEHOLDER", StringComparison.OrdinalIgnoreCase))
        {
            logger.LogWarning(
                "AzureStorage:ConnectionString is not configured. " +
                "Resume uploads will fall back to base64 storage in the database.");
            return;
        }

        try
        {
            _serviceClient = new BlobServiceClient(connectionString);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex,
                "Failed to initialise Azure Blob Storage. " +
                "Resume uploads will fall back to base64 storage in the database.");
        }
    }

    public async Task<string> UploadResumeAsync(byte[] bytes, string fileName, string contentType, int userId)
    {
        if (_serviceClient is null)
            throw new InvalidOperationException("Azure Blob Storage is not configured.");

        var container = _serviceClient.GetBlobContainerClient(_containerName);
        // PublicAccessType.Blob: individual blobs are readable without auth (needed for the frontend download link).
        // For stricter privacy, switch to None and return SAS URLs instead.
        await container.CreateIfNotExistsAsync(PublicAccessType.Blob);

        var blobName = $"user-{userId}/{Guid.NewGuid():N}/{fileName}";
        var blob = container.GetBlobClient(blobName);

        using var stream = new MemoryStream(bytes);
        await blob.UploadAsync(stream, new BlobHttpHeaders { ContentType = contentType });

        return blob.Uri.ToString();
    }

    public async Task<(byte[] Bytes, string ContentType)> DownloadResumeAsync(string blobUrl)
    {
        // For public blobs we can create a BlobClient directly from the URI without credentials.
        var blob = new BlobClient(new Uri(blobUrl));
        var response = await blob.DownloadContentAsync();
        return (
            response.Value.Content.ToArray(),
            response.Value.Details.ContentType ?? "application/octet-stream"
        );
    }

    // Blob URLs are HTTPS; legacy data URLs start with "data:".
    public bool IsBlobUrl(string? url) =>
        !string.IsNullOrWhiteSpace(url) &&
        url.StartsWith("https://", StringComparison.OrdinalIgnoreCase);
}
