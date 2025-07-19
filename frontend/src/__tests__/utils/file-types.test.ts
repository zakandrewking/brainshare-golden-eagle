import {
  describe,
  expect,
  it,
} from "vitest";

import {
  FILE_TYPE_DESCRIPTIONS,
  getFileTypeFromExtension,
  getSupportedFileTypesDisplay,
  isSupportedFileType,
  SUPPORTED_FILE_EXTENSIONS,
  SUPPORTED_FILE_TYPES,
  SUPPORTED_MIME_TYPES,
} from "@/utils/file-types";

describe("file-types utilities", () => {
  describe("constants", () => {
    it("should have correct supported file types", () => {
      expect(SUPPORTED_FILE_TYPES.CSV).toBe("csv");
      expect(SUPPORTED_FILE_TYPES.TXT).toBe("txt");
      expect(SUPPORTED_FILE_TYPES.IPYNB).toBe("ipynb");
    });

    it("should have correct file extensions array", () => {
      expect(SUPPORTED_FILE_EXTENSIONS).toEqual(["csv", "txt", "ipynb"]);
    });

    it("should have correct MIME types", () => {
      expect(SUPPORTED_MIME_TYPES).toEqual([
        "text/csv",
        "text/plain",
        "application/json",
      ]);
    });

    it("should have correct file type descriptions", () => {
      expect(FILE_TYPE_DESCRIPTIONS.csv).toBe("Comma-separated values");
      expect(FILE_TYPE_DESCRIPTIONS.txt).toBe("Plain text files");
      expect(FILE_TYPE_DESCRIPTIONS.ipynb).toBe("Jupyter notebooks");
    });
  });

  describe("isSupportedFileType", () => {
    it("should return true for supported file types", () => {
      expect(isSupportedFileType("data.csv")).toBe(true);
      expect(isSupportedFileType("document.txt")).toBe(true);
      expect(isSupportedFileType("notebook.ipynb")).toBe(true);
    });

    it("should handle uppercase extensions", () => {
      expect(isSupportedFileType("data.CSV")).toBe(true);
      expect(isSupportedFileType("document.TXT")).toBe(true);
      expect(isSupportedFileType("notebook.IPYNB")).toBe(true);
    });

    it("should return false for unsupported file types", () => {
      expect(isSupportedFileType("image.jpg")).toBe(false);
      expect(isSupportedFileType("document.pdf")).toBe(false);
      expect(isSupportedFileType("archive.zip")).toBe(false);
    });

    it("should handle files without extensions", () => {
      expect(isSupportedFileType("noextension")).toBe(false);
      expect(isSupportedFileType("")).toBe(false);
    });

    it("should handle files with multiple dots", () => {
      expect(isSupportedFileType("my.data.file.csv")).toBe(true);
      expect(isSupportedFileType("test.backup.txt")).toBe(true);
      expect(isSupportedFileType("old.version.pdf")).toBe(false);
    });
  });

  describe("getFileTypeFromExtension", () => {
    it("should return correct extension for supported files", () => {
      expect(getFileTypeFromExtension("data.csv")).toBe("csv");
      expect(getFileTypeFromExtension("document.txt")).toBe("txt");
      expect(getFileTypeFromExtension("notebook.ipynb")).toBe("ipynb");
    });

    it("should handle uppercase extensions", () => {
      expect(getFileTypeFromExtension("data.CSV")).toBe("csv");
      expect(getFileTypeFromExtension("document.TXT")).toBe("txt");
      expect(getFileTypeFromExtension("notebook.IPYNB")).toBe("ipynb");
    });

    it("should return null for unsupported file types", () => {
      expect(getFileTypeFromExtension("image.jpg")).toBe(null);
      expect(getFileTypeFromExtension("document.pdf")).toBe(null);
      expect(getFileTypeFromExtension("archive.zip")).toBe(null);
    });

    it("should handle files without extensions", () => {
      expect(getFileTypeFromExtension("noextension")).toBe(null);
      expect(getFileTypeFromExtension("")).toBe(null);
    });

    it("should handle files with multiple dots", () => {
      expect(getFileTypeFromExtension("my.data.file.csv")).toBe("csv");
      expect(getFileTypeFromExtension("test.backup.txt")).toBe("txt");
      expect(getFileTypeFromExtension("old.version.pdf")).toBe(null);
    });
  });

  describe("getSupportedFileTypesDisplay", () => {
    it("should return formatted display string", () => {
      const displayString = getSupportedFileTypesDisplay();
      expect(displayString).toBe(".CSV, .TXT, .IPYNB");
    });
  });
});
