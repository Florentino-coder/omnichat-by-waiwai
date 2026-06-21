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

  validateBufferContent(buffer: Buffer, mimeType: string): void {
    if (mimeType === "application/pdf") {
      if (buffer.length < 4 || buffer.readUInt32BE(0) !== 0x25504446) {
        throw new BadRequestException("Invalid PDF file structure (magic bytes mismatch)");
      }
    } else if (
      mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      if (buffer.length < 2 || buffer.readUInt16BE(0) !== 0x504B) {
        throw new BadRequestException("Invalid DOCX file structure (magic bytes mismatch)");
      }
    }
  }

  async extractFromBuffer(buffer: Buffer, mimeType: string): Promise<string> {
    this.assertAllowedUploadMimeType(mimeType);
    this.validateBufferContent(buffer, mimeType);

    let text = "";

    if (mimeType === "application/pdf") {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: buffer });
      try {
        const parsePromise = parser.getText();
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("PDF parsing timeout")), 30000)
        );
        const parsed = await Promise.race([parsePromise, timeoutPromise]);
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
