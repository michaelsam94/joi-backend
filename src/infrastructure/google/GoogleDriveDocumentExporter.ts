import { google } from 'googleapis';
import { Readable } from 'stream';
import { DocumentExporter, QrSheetEntry } from '../../application/ports/DocumentExporter';
import { buildQrSheetPdf } from '../pdf/QrSheetPdfBuilder';
import { NotConfiguredError } from '../../domain/errors/AppError';

export interface GoogleDriveConfig {
  /** Raw service-account JSON string, or a path to the JSON key file. */
  serviceAccountJson?: string;
  driveFolderId?: string;
}

/**
 * Builds the QR sheet as a PDF, then uploads it to Drive requesting
 * conversion to a native Google Doc (mimeType application/vnd.google-apps.document) —
 * Drive does the PDF -> Doc conversion for us, so no direct Docs-API image
 * insertion calls are needed.
 */
export class GoogleDriveDocumentExporter implements DocumentExporter {
  constructor(private readonly config: GoogleDriveConfig) {}

  get enabled(): boolean {
    return Boolean(this.config.serviceAccountJson && this.config.driveFolderId);
  }

  async exportQrSheet(entries: QrSheetEntry[]): Promise<{ url: string }> {
    if (!this.enabled) {
      throw new NotConfiguredError(
        'Google export is not configured yet: set GOOGLE_SERVICE_ACCOUNT_JSON and GOOGLE_DRIVE_FOLDER_ID in .env',
      );
    }

    const pdfBuffer = await buildQrSheetPdf(entries);

    const credentials = this.loadCredentials(this.config.serviceAccountJson!);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });
    const drive = google.drive({ version: 'v3', auth });

    const res = await drive.files.create({
      requestBody: {
        name: `Joi QR Codes — ${new Date().toISOString().slice(0, 10)}`,
        parents: [this.config.driveFolderId!],
        mimeType: 'application/vnd.google-apps.document',
      },
      media: {
        mimeType: 'application/pdf',
        body: Readable.from(pdfBuffer),
      },
      fields: 'id, webViewLink',
    });

    return { url: res.data.webViewLink ?? `https://docs.google.com/document/d/${res.data.id}/edit` };
  }

  private loadCredentials(serviceAccountJson: string): Record<string, unknown> {
    // Accept either a raw JSON string (e.g. from an env var) or a filesystem path.
    const trimmed = serviceAccountJson.trim();
    if (trimmed.startsWith('{')) {
      return JSON.parse(trimmed);
    }
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require('fs');
    return JSON.parse(fs.readFileSync(trimmed, 'utf-8'));
  }
}
