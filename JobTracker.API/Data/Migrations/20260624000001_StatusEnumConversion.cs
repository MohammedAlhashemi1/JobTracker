using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace JobTracker.API.Data.Migrations
{
    /// <inheritdoc />
    public partial class StatusEnumConversion : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // No schema change: the Status column was and remains nvarchar(50).
            // This migration records the switch from a raw string property to
            // ApplicationStatus enum with HasConversion<string>().
            // Existing data is already stored as the enum member names ("Applied" etc.)
            // so no data migration is required.
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Nothing to undo — the column type is unchanged.
        }
    }
}
