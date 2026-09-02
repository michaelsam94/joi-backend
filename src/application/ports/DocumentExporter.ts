export interface QrSheetEntry {
  fullName: string;
  qrPng: Buffer;
}

export interface DocumentExporter {
  /** Builds a printable QR sheet and returns a shareable URL to the resulting document. */
  exportQrSheet(entries: QrSheetEntry[]): Promise<{ url: string }>;
}
