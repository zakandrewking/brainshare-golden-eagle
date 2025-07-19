export const SUPPORTED_FILE_TYPES = {
  CSV: "csv",
  TXT: "txt",
  IPYNB: "ipynb",
} as const;

export const SUPPORTED_FILE_EXTENSIONS = Object.values(SUPPORTED_FILE_TYPES);

export const SUPPORTED_MIME_TYPES = [
  "text/csv",
  "text/plain",
  "application/json", // for .ipynb files
] as const;

export const FILE_TYPE_DESCRIPTIONS = {
  [SUPPORTED_FILE_TYPES.CSV]: "Comma-separated values",
  [SUPPORTED_FILE_TYPES.TXT]: "Plain text files",
  [SUPPORTED_FILE_TYPES.IPYNB]: "Jupyter notebooks",
} as const;

type SupportedExtension =
  (typeof SUPPORTED_FILE_TYPES)[keyof typeof SUPPORTED_FILE_TYPES];

export function isSupportedFileType(fileName: string): boolean {
  const extension = fileName.split(".").pop()?.toLowerCase();
  return extension
    ? (SUPPORTED_FILE_EXTENSIONS as readonly string[]).includes(extension)
    : false;
}

export function getFileTypeFromExtension(
  fileName: string
): SupportedExtension | null {
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (!extension) return null;

  return (SUPPORTED_FILE_EXTENSIONS as readonly string[]).includes(extension)
    ? (extension as SupportedExtension)
    : null;
}

export function getSupportedFileTypesDisplay(): string {
  return SUPPORTED_FILE_EXTENSIONS.map((ext) => `.${ext.toUpperCase()}`).join(
    ", "
  );
}
