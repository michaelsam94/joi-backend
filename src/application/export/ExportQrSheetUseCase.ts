import { UserRepository } from '../ports/UserRepository';
import { QrCodeGenerator } from '../ports/QrCodeGenerator';
import { DocumentExporter } from '../ports/DocumentExporter';

/** Moderator action: builds a printable Google Doc containing every active member's QR code + name. */
export class ExportQrSheetUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly qr: QrCodeGenerator,
    private readonly exporter: DocumentExporter,
  ) {}

  async execute(): Promise<{ url: string; count: number }> {
    const members = (await this.users.list({ activeOnly: true })).filter((u) => u.role === 'MEMBER');
    const entries = await Promise.all(
      members.map(async (m) => ({ fullName: m.fullName, qrPng: await this.qr.generatePng(m.qrToken) })),
    );
    const { url } = await this.exporter.exportQrSheet(entries);
    return { url, count: entries.length };
  }
}
