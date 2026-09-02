export interface QrCodeGenerator {
  /** Returns a PNG image buffer encoding the given token/string. */
  generatePng(data: string): Promise<Buffer>;
}
