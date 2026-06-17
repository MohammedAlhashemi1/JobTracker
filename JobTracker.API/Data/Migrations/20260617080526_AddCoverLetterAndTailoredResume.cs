using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace JobTracker.API.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddCoverLetterAndTailoredResume : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CoverLetter",
                table: "Applications",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TailoredResume",
                table: "Applications",
                type: "nvarchar(max)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CoverLetter",
                table: "Applications");

            migrationBuilder.DropColumn(
                name: "TailoredResume",
                table: "Applications");
        }
    }
}
