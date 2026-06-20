import { BadRequestException, Injectable } from "@nestjs/common";

const MAX_EXTRACTED_TEXT_LENGTH = 100_000;

const ALLOWED_UPLOAD_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain"
]);

@Injectable()
export class KnowledgeTextExtractionService {
  assertAllowedUploadMimeType(mimeType: string): void {
    if (!ALLOWED_UPLOAD_MIME_TYPES.has(mimeType)) {
      throw new BadRequestException(
        "Unsupported file type. Allowed: PDF, DOCX, or plain text."
      );
    }
  }

  async extractFromBuffer(buffer: Buffer, mimeType: string): Promise<string> {
    this.assertAllowedUploadMimeType(mimeType);

    let text = "";

    if (mimeType === "application/pdf") {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: buffer });
      try {
        const parsed = await parser.getText();
        text = parsed.text ?? "";
      } finally {
        await parser.destroy();
      }
    } else if (
      mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      const mammoth = await import("mammoth");
      const parsed = await mammoth.extractRawText({ buffer });
      text = parsed.value ?? "";
    } else {
      text = buffer.toString("utf8");
    }

    return this.normalizeExtractedText(text);
  }

  extractFromHtml(html: string): string {
    const withoutScripts = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ");
    const withoutTags = withoutScripts.replace(/<[^>]+>/g, " ");
    return this.normalizeExtractedText(withoutTags);
  }

  normalizeExtractedText(text: string): string {
    const normalized = text.replace(/\u0000/g, "").replace(/\s+/g, " ").trim();

    if (normalized.length < 20) {
      throw new BadRequestException("Extracted text is too short to index (minimum 20 characters)");
    }

    if (normalized.length > MAX_EXTRACTED_TEXT_LENGTH) {
      return normalized.slice(0, MAX_EXTRACTED_TEXT_LENGTH);
    }

    return normalized;
  }
}
