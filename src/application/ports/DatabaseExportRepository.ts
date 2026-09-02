/** One table shaped as a ready-to-write spreadsheet tab — headers plus rows, with foreign keys
 * already resolved to readable names (member/prize names, not raw UUIDs). */
export interface ExportTable {
  title: string;
  headers: string[];
  rows: (string | number | boolean | null)[][];
}

export interface DatabaseExportRepository {
  /** Every table in the database, one entry per table — powers the moderator "Export all data"
   * button (see ExportDatabaseUseCase). */
  exportAllTables(): Promise<ExportTable[]>;
}
