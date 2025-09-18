import { FinancialRecord } from '@/types/financial';

export class GoogleSheetsService {
  private static API_KEY_STORAGE_KEY = 'google_sheets_api_key';
  private static SHEET_ID_STORAGE_KEY = 'google_sheets_sheet_id';
  
  // Configure aqui suas credenciais padrão (opcional)
  // ATENÇÃO: API keys aqui ficam visíveis no código. Use apenas para planilhas públicas.
  private static readonly DEFAULT_API_KEY = ''; // Cole sua API key aqui se quiser manter no código
  private static readonly DEFAULT_SHEET_ID = ''; // Cole o ID da planilha aqui se quiser manter no código

  static saveApiKey(apiKey: string): void {
    localStorage.setItem(this.API_KEY_STORAGE_KEY, apiKey);
  }

  static getApiKey(): string | null {
    return localStorage.getItem(this.API_KEY_STORAGE_KEY) || this.DEFAULT_API_KEY || null;
  }

  static saveSheetId(sheetId: string): void {
    localStorage.setItem(this.SHEET_ID_STORAGE_KEY, sheetId);
  }

  static getSheetId(): string | null {
    return localStorage.getItem(this.SHEET_ID_STORAGE_KEY) || this.DEFAULT_SHEET_ID || null;
  }

  static hasDefaultCredentials(): boolean {
    return !!(this.DEFAULT_API_KEY && this.DEFAULT_SHEET_ID);
  }

  static extractSheetId(url: string): string | null {
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : null;
  }

  static async testConnection(): Promise<boolean> {
    const apiKey = this.getApiKey();
    const sheetId = this.getSheetId();
    
    if (!apiKey || !sheetId) return false;

    try {
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?key=${apiKey}`
      );
      return response.ok;
    } catch (error) {
      console.error('Error testing Google Sheets connection:', error);
      return false;
    }
  }

  static async fetchSheetData(): Promise<FinancialRecord[]> {
    const apiKey = this.getApiKey();
    const sheetId = this.getSheetId();
    
    if (!apiKey || !sheetId) {
      throw new Error('API key ou Sheet ID não configurados');
    }

    try {
      // Fetch data from the specific range that contains the financial data
      const range = 'A:O'; // Adjust based on your sheet structure
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?key=${apiKey}`
      );

      if (!response.ok) {
        throw new Error(`Erro ao buscar dados: ${response.statusText}`);
      }

      const data = await response.json();
      const rows = data.values || [];
      
      return this.parseSheetData(rows);
    } catch (error) {
      console.error('Error fetching sheet data:', error);
      throw error;
    }
  }

  private static parseSheetData(rows: string[][]): FinancialRecord[] {
    const records: FinancialRecord[] = [];
    
    // Skip header rows and empty rows
    for (let i = 7; i < rows.length; i++) { // Start from row 8 (index 7) based on your sheet structure
      const row = rows[i];
      
      // Skip empty rows
      if (!row || row.length < 8 || !row[2]) continue;
      
      // Parse the row data according to your sheet structure
      const consultant = row[0] || '';
      const contractDate = this.parseDate(row[1]);
      const studentName = row[2];
      const installment = row[3] || '';
      const dueDate = this.parseDate(row[4]);
      const amount = this.parseAmount(row[5]);
      const paymentDate = this.parseDate(row[6]);
      const status = this.parseStatus(row[7]);
      const invoice = row[8] || '';
      const contract = row[9] || '';

      if (studentName && dueDate && amount > 0) {
        records.push({
          id: `${i}`,
          consultant,
          contractDate,
          studentName,
          installment,
          dueDate,
          amount,
          paymentDate: paymentDate || undefined,
          status,
          invoice,
          contract
        });
      }
    }

    return records;
  }

  private static parseDate(dateStr: string): string {
    if (!dateStr) return '';
    
    // Handle Brazilian date format (DD/MM/YYYY)
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const [day, month, year] = parts;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    
    return dateStr;
  }

  private static parseAmount(amountStr: string): number {
    if (!amountStr) return 0;
    
    // Remove R$, spaces, and convert comma to dot
    const cleanAmount = amountStr
      .replace(/R\$\s?/, '')
      .replace(/\./g, '')
      .replace(',', '.');
    
    return parseFloat(cleanAmount) || 0;
  }

  private static parseStatus(statusStr: string): 'PAGO' | 'A PAGAR' | 'VENCIDO' {
    const status = statusStr?.toUpperCase();
    if (status === 'PAGO') return 'PAGO';
    if (status === 'VENCIDO') return 'VENCIDO';
    return 'A PAGAR';
  }

  static async updateSheetData(records: FinancialRecord[]): Promise<boolean> {
    const apiKey = this.getApiKey();
    const sheetId = this.getSheetId();
    
    if (!apiKey || !sheetId) {
      throw new Error('API key ou Sheet ID não configurados');
    }

    try {
      // Convert records back to sheet format
      const values = records.map(record => [
        record.consultant,
        this.formatDateForSheet(record.contractDate),
        record.studentName,
        record.installment,
        this.formatDateForSheet(record.dueDate),
        `R$ ${record.amount.toFixed(2).replace('.', ',')}`,
        record.paymentDate ? this.formatDateForSheet(record.paymentDate) : '',
        record.status,
        record.invoice || '',
        record.contract || ''
      ]);

      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/A8:J${8 + values.length - 1}?valueInputOption=RAW&key=${apiKey}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            values
          })
        }
      );

      return response.ok;
    } catch (error) {
      console.error('Error updating sheet data:', error);
      throw error;
    }
  }

  private static formatDateForSheet(dateStr: string): string {
    if (!dateStr) return '';
    
    const date = new Date(dateStr);
    return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
  }
}