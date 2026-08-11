export const DOCUMENT_MAX_BYTES = 25 * 1024 * 1024;

const ALLOWED_EXTENSIONS = new Set([".pdf", ".docx", ".pptx"]);

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

export function extensionFromFilename(filename: string): string {
  const match = filename.toLowerCase().match(/(\.[a-z0-9]+)$/);
  return match?.[1] ?? "";
}

export function validateDocumentFile(file: File): string | null {
  if (file.size > DOCUMENT_MAX_BYTES) {
    return "Document must be under 25MB";
  }

  const ext = extensionFromFilename(file.name);
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return "Only PDF, DOCX, and PPTX files are allowed";
  }

  if (file.type && !ALLOWED_MIME_TYPES.has(file.type)) {
    return "Unsupported file type";
  }

  return null;
}

export function contentTypeFromFilename(filename: string): string {
  const ext = extensionFromFilename(filename);
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".docx") {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (ext === ".pptx") {
    return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  }
  return "application/octet-stream";
}
