import { ExportDatabaseUseCase } from '../../src/application/admin/ExportDatabaseUseCase';
import { FakeDatabaseExportRepository, FakeDocumentExporter } from './fakes';

describe('ExportDatabaseUseCase', () => {
  it('hands every table straight through to the exporter and returns its URL', async () => {
    const tables = [
      { title: 'Members', headers: ['Full name'], rows: [['Ada']] },
      { title: 'Prizes', headers: ['Name'], rows: [['Snack']] },
    ];
    const repo = new FakeDatabaseExportRepository(tables);
    const exporter = new FakeDocumentExporter();
    const useCase = new ExportDatabaseUseCase(repo, exporter);

    const result = await useCase.execute();

    expect(result.url).toBe('https://docs.google.com/spreadsheets/d/fake-sheet/edit');
    expect(exporter.lastDatabaseTabs).toEqual(tables);
  });
});
