export const MAX_FILE_BYTES = 5 * 1024 * 1024;

export const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);

const ALLOWED_EXT = /\.(jpe?g|png|gif|webp|pdf|docx|txt)$/i;

export function fileError(file: File): string | null {
  if (file.size <= 0) return `${file.name} is empty`;
  if (file.size > MAX_FILE_BYTES) return `${file.name} is larger than 5MB`;
  if (file.type) {
    if (!ALLOWED_TYPES.has(file.type)) {
      return `${file.name} is not an allowed type`;
    }
  } else if (!ALLOWED_EXT.test(file.name)) {
    return `${file.name} is not an allowed type`;
  }
  return null;
}
