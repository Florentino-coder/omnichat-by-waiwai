import { BadRequestException } from "@nestjs/common";
import { KnowledgeTextExtractionService } from "./knowledge-text-extraction.service";

describe("KnowledgeTextExtractionService", () => {
  const service = new KnowledgeTextExtractionService();

  it("extracts plain text from buffer", async () => {
    const text = await service.extractFromBuffer(
      Buffer.from("This is a long enough plain text document for indexing."),
      "text/plain"
    );
    expect(text).toContain("plain text document");
  });

  it("rejects unsupported mime types", async () => {
    await expect(
      service.extractFromBuffer(Buffer.from("binary"), "application/octet-stream")
    ).rejects.toThrow(BadRequestException);
  });

  it("strips HTML tags", () => {
    const text = service.extractFromHtml(
      "<html><body><h1>Shipping</h1><p>We ship within 3 business days nationwide.</p></body></html>"
    );
    expect(text).toContain("Shipping");
    expect(text).toContain("3 business days");
    expect(text).not.toContain("<h1>");
  });

  it("rejects text shorter than 20 characters", () => {
    expect(() => service.normalizeExtractedText("too short")).toThrow(BadRequestException);
  });
});
