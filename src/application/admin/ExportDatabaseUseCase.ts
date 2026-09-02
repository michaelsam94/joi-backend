import { DatabaseExportRepository } from '../ports/DatabaseExportRepository';
import { DocumentExporter } from '../ports/DocumentExporter';

/** Moderator action: dumps every table in the database into a single Google Sheet — one tab per
 * table — and returns a link to it. */
export class ExportDatabaseUseCase {
  constructor(
    private readonly exportRepo: DatabaseExportRepository,
    private readonly exporter: DocumentExporter,
  ) {}

  async execute(): Promise<{ url: string }> {
    const tabs = await this.exportRepo.exportAllTables();
    return this.exporter.exportDatabaseSheet(tabs);
  }
}
