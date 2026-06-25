# ── Stage 1: build ───────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Restore dependencies in a cached layer (only re-runs when csproj changes)
COPY JobTracker.API/JobTracker.API.csproj JobTracker.API/
RUN dotnet restore JobTracker.API/JobTracker.API.csproj

# Copy source and publish a Release build
COPY JobTracker.API/ JobTracker.API/
RUN dotnet publish JobTracker.API/JobTracker.API.csproj \
    -c Release \
    -o /app/publish \
    --no-restore

# ── Stage 2: runtime ─────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=build /app/publish .

EXPOSE 8080

# Railway injects $PORT at container start; fall back to 8080 if not set.
CMD ["/bin/sh", "-c", "exec dotnet JobTracker.API.dll --urls http://+:${PORT:-8080}"]
