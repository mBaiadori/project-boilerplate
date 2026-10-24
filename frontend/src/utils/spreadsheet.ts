import readXlsxFile from 'read-excel-file/browser';

export interface SpreadsheetData {
  sheetNames: string[];
  activeSheet: string;
  rows: (string | number | boolean | null)[][];
}

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB limite defensivo contra estouro de memória
const MAX_ROWS = 10000; // Limite de renderização para manter a UI fluida

/**
 * Adaptador seguro para leitura de planilhas Excel (.xlsx) sem prototype pollution e com limites estritos.
 */
export async function parseSpreadsheet(
  buffer: ArrayBuffer,
  sheetName?: string
): Promise<SpreadsheetData> {
  if (buffer.byteLength > MAX_FILE_SIZE) {
    throw new Error('Arquivo de planilha excede o limite máximo permitido (25MB).');
  }

  const blob = new Blob([buffer]);
  const sheets = await readXlsxFile(blob);
  const sheetNames = sheets.map((s) => s.sheet);
  const target = (sheetName && sheets.find((s) => s.sheet === sheetName)) || sheets[0];

  const rawRows = target ? target.data : [];
  const rows: (string | number | boolean | null)[][] = rawRows.slice(0, MAX_ROWS).map((row) =>
    row.map((cell) => {
      if (cell === null || cell === undefined) return '';
      if (typeof cell === 'string' || typeof cell === 'number' || typeof cell === 'boolean') {
        return cell;
      }
      if (cell instanceof Date) {
        return cell.toLocaleDateString();
      }
      return String(cell);
    })
  );

  return {
    sheetNames,
    activeSheet: target?.sheet || 'Sheet1',
    rows,
  };
}
