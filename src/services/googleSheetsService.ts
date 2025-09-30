import { FinancialRecord } from '@/types/financial';

export class GoogleSheetsService {
  private static API_KEY_STORAGE_KEY = 'google_sheets_api_key';
  private static SHEET_ID_STORAGE_KEY = 'google_sheets_sheet_id';
  
  // Configure aqui suas credenciais padrão (opcional)
  // ATENÇÃO: API keys aqui ficam visíveis no código. Use apenas para planilhas públicas.
  private static readonly DEFAULT_API_KEY = 'AIzaSyBbeZZchnUg5I35r_7QHjzNDNbXOL8zmz4'; // Cole sua API key aqui se quiser manter no código
  private static readonly DEFAULT_SHEET_ID = '1QO7qMomtQlCRZf5sa_SkLgSG3Q3Y-cpDCEKQopz5Yg4'; // Cole o ID da planilha aqui se quiser manter no código

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

  static async fetchDREData(): Promise<any[]> {
    const apiKey = this.getApiKey();
    const sheetId = this.getSheetId();
    
    if (!apiKey || !sheetId) {
      throw new Error('API key ou Sheet ID não configurados');
    }

    try {
      // Fetch data from Página2 for DRE data
      const range = 'Página2!A:Z';
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?key=${apiKey}`
      );

      if (!response.ok) {
        throw new Error(`Erro ao buscar dados do DRE: ${response.statusText}`);
      }

      const data = await response.json();
      const rows = data.values || [];
      
      return this.parseDREData(rows);
    } catch (error) {
      console.error('Error fetching DRE data:', error);
      throw error;
    }
  }

  static async fetchCashFlowData(): Promise<any[]> {
    const apiKey = this.getApiKey();
    const sheetId = this.getSheetId();
    
    if (!apiKey || !sheetId) {
      throw new Error('API key ou Sheet ID não configurados');
    }

    try {
      // Fetch data from Página3 for Cash Flow data
      const range = 'Página3!A:Z';
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?key=${apiKey}`
      );

      if (!response.ok) {
        throw new Error(`Erro ao buscar dados do Fluxo de Caixa: ${response.statusText}`);
      }

      const data = await response.json();
      const rows = data.values || [];
      
      return this.parseCashFlowData(rows);
    } catch (error) {
      console.error('Error fetching Cash Flow data:', error);
      throw error;
    }
  }

  static async fetchLanceADoisData(): Promise<{ revenues: any[], expenses: any[] }> {
    const apiKey = this.getApiKey();
    const sheetId = this.getSheetId();
    
    if (!apiKey || !sheetId) {
      throw new Error('API key ou Sheet ID não configurados');
    }

    try {
      // Fetch data from Página2 for Lance a Dois data (column G)
      const range = 'Página2!A:Z';
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?key=${apiKey}`
      );

      if (!response.ok) {
        throw new Error(`Erro ao buscar dados Lance a Dois: ${response.statusText}`);
      }

      const data = await response.json();
      const rows = data.values || [];
      
      const result = this.parseLanceADoisData(rows);
      return result;
    } catch (error) {
      console.error('Error fetching Lance a Dois data:', error);
      throw error;
    }
  }

  static async fetchLanceADoisTaxData(): Promise<{ taxPercentage: number; month: string; year: string } | null> {
    const apiKey = this.getApiKey();
    const sheetId = this.getSheetId();
    
    if (!apiKey || !sheetId) {
      throw new Error('API key ou Sheet ID não configurados');
    }

    try {
      const range = 'Página2!A:Z';
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?key=${apiKey}`
      );

      if (!response.ok) {
        throw new Error(`Erro ao buscar dados de impostos: ${response.statusText}`);
      }

      const data = await response.json();
      const rows = data.values || [];
      
      return this.parseLanceADoisTaxData(rows);
    } catch (error) {
      console.error('Error fetching tax data:', error);
      throw error;
    }
  }

  private static parseDREData(rows: string[][]): any[] {
    const dreRecords: any[] = [];
    
    console.log('DRE Parsing - Total rows:', rows.length);
    console.log('First 10 rows preview:', rows.slice(0, 10));
    
    // Skip first few rows and find data starting from row with actual content
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      
      if (!row || row.length === 0) continue;
      
      const type = (row[0] || '').toString().trim(); // Column A - type (ENTRADA/SAÍDA)
      const description = (row[1] || '').toString().trim(); // Column B - names of receipts/expenses
      const details = (row[2] || '').toString().trim(); // Column C - detalhamento
      const extraDetail1 = (row[3] || '').toString().trim(); // Column D
      const amount = this.parseAmount(row[4] || ''); // Column E - amounts (valor)
      const date = (row[5] || '').toString().trim(); // Column F - date
      const extraDetail2 = (row[6] || '').toString().trim(); // Column G
      
      // Log rows that contain specific names for debugging
      const fullRowText = row.join(' ').toUpperCase();
      if (fullRowText.includes('MARIA') || fullRowText.includes('EDLAMAR') || fullRowText.includes('PRISCILA')) {
        console.log(`Found name in row ${i}:`, {
          rowIndex: i,
          fullRow: row,
          type,
          description,
          details,
          extraDetail1,
          extraDetail2,
          amount,
          date
        });
      }
      
      // Log first few rows for debugging
      if (i <= 10) {
        console.log(`DRE Row ${i}:`, {
          type,
          description,
          details,
          amount,
          date,
          extraDetail1,
          extraDetail2
        });
      }
      
      // Check if this is a valid DRE entry - be more flexible with criteria
      if (description || type || amount !== 0 || date || extraDetail1 || extraDetail2) {
        // Extract month and year from date
        let month = '';
        let year = '';
        
        if (date) {
          // Try to parse Brazilian date format (DD/MM/YYYY)
          const dateParts = date.split('/');
          if (dateParts.length === 3) {
            month = dateParts[1].padStart(2, '0'); // MM
            year = dateParts[2]; // YYYY
          } else {
            // Try other date formats
            const parsedDate = new Date(date);
            if (!isNaN(parsedDate.getTime())) {
              month = String(parsedDate.getMonth() + 1).padStart(2, '0');
              year = String(parsedDate.getFullYear());
            }
          }
        }
        
        // If no date, try to extract from other fields or use current date
        if (!month || !year) {
          const currentDate = new Date();
          month = month || String(currentDate.getMonth() + 1).padStart(2, '0');
          year = year || String(currentDate.getFullYear());
        }
        
        // Determine type more flexibly
        let recordType = 'DESPESA'; // default
        if (type.toUpperCase().includes('ENTRADA') || 
            type.toUpperCase().includes('RECEITA') || 
            description.toUpperCase().includes('RECEITA') ||
            description.toUpperCase().includes('CLUBE') ||
            extraDetail1.toUpperCase().includes('CLUBE') ||
            extraDetail2.toUpperCase().includes('CLUBE')) {
          recordType = 'RECEITA';
        }
        
        dreRecords.push({
          id: `dre_${i}`,
          type: recordType,
          description: description || `Item ${i}`,
          details,
          amount: Math.abs(amount) || 0,
          month,
          year,
          date,
          extraDetail1,
          extraDetail2,
          originalAmount: amount,
          sourceType: type // preserva valor original da coluna A (ex.: 02-SAÍDAS)
        });
        
        // Log specific entries that contain names
        const fullRowText = row.join(' ').toUpperCase();
        if (fullRowText.includes('MARIA') || fullRowText.includes('EDLAMAR') || fullRowText.includes('PRISCILA')) {
          console.log(`Created DRE record for ${description}:`, {
            type: recordType,
            description,
            details,
            extraDetail1,
            extraDetail2,
            amount: Math.abs(amount),
            month,
            year
          });
        }
      }
    }
    
    console.log('DRE Records parsed total:', dreRecords.length);
    console.log('Available months:', [...new Set(dreRecords.map(r => r.month))]);
    console.log('Available years:', [...new Set(dreRecords.map(r => r.year))]);
    
    return dreRecords;
  }

  private static parseCashFlowData(rows: string[][]): any[] {
    const cashFlowRecords: any[] = [];
    
    console.log('Cash Flow Parsing - Total rows:', rows.length);
    console.log('First 20 rows preview:', rows.slice(0, 20));
    
    // Process each row - Coluna A = título, Coluna B = valor
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      
      if (!row || row.length === 0) continue;
      
      const titulo = (row[0] || '').toString().trim(); // Coluna A
      const valorStr = (row[1] || '').toString().trim(); // Coluna B
      
      // Parse valor brasileiro (vírgula como decimal)
      const parseValor = (str: string): number => {
        if (!str) return 0;
        const cleanStr = str.replace(/[^\d,-]/g, '').replace(',', '.');
        const num = parseFloat(cleanStr);
        return isNaN(num) ? 0 : num;
      };
      
      const valor = parseValor(valorStr);
      
      cashFlowRecords.push({
        id: `cf-${i}`,
        category: titulo,        // Coluna A (título)
        description: titulo,     // Repetição para compatibilidade
        subcategory: valorStr,   // Coluna B (valor como string)
        detail: '',
        amount: valor,           // Valor convertido para número
        date: '',
        bank: '',
        type: valor >= 0 ? 'ENTRADA' : 'SAÍDA'
      });
    }
    
    console.log('Parsed Cash Flow records:', cashFlowRecords.length);
    console.log('Sample records:', cashFlowRecords.slice(0, 10));
    return cashFlowRecords;
  }

  private static parseLanceADoisData(rows: string[][]): { revenues: any[], expenses: any[] } {
    const lanceADoisRevenues: any[] = [];
    const lanceADoisExpenses: any[] = [];
    
    console.log('Lance a Dois Parsing - Total rows:', rows.length);
    console.log('First 10 rows preview:', rows.slice(0, 10));
    
    // Skip first row (header) and find data starting from row with actual content
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      
      if (!row || row.length === 0) continue;
      
      const type = (row[0] || '').toString().trim(); // Column A
      const description = (row[1] || '').toString().trim(); // Column B - product/course name
      const details = (row[2] || '').toString().trim(); // Column C - student/customer name
      const extraDetail1 = (row[3] || '').toString().trim(); // Column D
      const amount = this.parseAmount(row[4] || ''); // Column E - amount
      const date = (row[5] || '').toString().trim(); // Column F - date
      const lanceADoisMarker = (row[6] || '').toString().trim().toUpperCase(); // Column G - LANCE A DOIS marker
      
      // Filter only records where column G contains "LANCE A DOIS"
      if (!lanceADoisMarker.includes('LANCE A DOIS')) {
        continue;
      }
      
      // Extract month and year from date
      let month = '';
      let year = '';
      
      if (date) {
        // Try to parse Brazilian date format (DD/MM/YYYY)
        const dateParts = date.split('/');
        if (dateParts.length === 3) {
          month = dateParts[1].padStart(2, '0'); // MM
          year = dateParts[2]; // YYYY
        }
      }
      
      // Check if it's revenue (ENTRADA) or expense (SAÍDA)
      if (type.toUpperCase().includes('01-ENTRADAS') || type.toUpperCase().includes('ENTRADA')) {
        lanceADoisRevenues.push({
          id: `lance-revenue-${i}`,
          description: description || 'Sem descrição',
          details: details || 'Sem detalhes',
          amount: amount,
          month: month,
          year: year,
          date: date,
          extraDetail1: extraDetail1,
          extraDetail2: lanceADoisMarker
        });
        
        // Log for debugging
        if (lanceADoisRevenues.length <= 5) {
          console.log(`Lance a Dois revenue ${lanceADoisRevenues.length}:`, {
            description,
            details,
            amount,
            date,
            month,
            year
          });
        }
      } else if (type.toUpperCase().includes('02-SAÍDAS') || type.toUpperCase().includes('SAÍDA')) {
        // This is an expense
        lanceADoisExpenses.push({
          id: `lance-expense-${i}`,
          description: description || 'Sem descrição',
          details: details || 'Sem detalhes',
          amount: Math.abs(amount), // Make sure it's positive for display
          month: month,
          year: year,
          date: date,
          extraDetail1: extraDetail1,
          extraDetail2: lanceADoisMarker
        });
        
        // Log for debugging
        if (lanceADoisExpenses.length <= 5) {
          console.log(`Lance a Dois expense ${lanceADoisExpenses.length}:`, {
            description,
            details,
            amount: Math.abs(amount),
            date,
            month,
            year
          });
        }
      }
    }
    
    console.log('Parsed Lance a Dois revenues:', lanceADoisRevenues.length);
    console.log('Parsed Lance a Dois expenses:', lanceADoisExpenses.length);
    return { revenues: lanceADoisRevenues, expenses: lanceADoisExpenses };
  }

  private static parseLanceADoisTaxData(rows: string[][]): { taxPercentage: number; month: string; year: string } | null {
    console.log('Tax Data Parsing - Total rows:', rows.length);
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      
      if (!row || row.length === 0) continue;
      
      const type = (row[0] || '').toString().trim().toUpperCase(); // Column A
      const taxPercentageStr = (row[4] || '').toString().trim(); // Column E - tax percentage
      const date = (row[5] || '').toString().trim(); // Column F - date
      const lanceADoisMarker = (row[6] || '').toString().trim().toUpperCase(); // Column G
      
      // Look for row where Column A = "05-IMPOSTOS" and Column G = "LANCE A DOIS"
      if (type.includes('05-IMPOSTOS') && lanceADoisMarker.includes('LANCE A DOIS')) {
        const taxPercentage = this.parseAmount(taxPercentageStr);
        
        // Extract month and year from date
        let month = '';
        let year = '';
        
        if (date) {
          const dateParts = date.split('/');
          if (dateParts.length === 3) {
            month = dateParts[1].padStart(2, '0');
            year = dateParts[2];
          }
        }
        
        console.log('Found tax data:', { taxPercentage, month, year, date });
        
        return { taxPercentage, month, year };
      }
    }
    
    console.log('No tax data found');
    return null;
  }

  private static parseSheetData(rows: string[][]): FinancialRecord[] {
    const records: FinancialRecord[] = [];

    const totalRows = rows.length;
    // Detect header row dynamically (expects a row containing "ALUNOS")
    const headerIndex = rows.findIndex((row) => {
      const c2 = (row?.[2] || '').toString().trim().toUpperCase();
      return c2 === 'ALUNOS' || row.some((c) => (c || '').toString().trim().toUpperCase() === 'ALUNOS');
    });

    const startIndex = headerIndex >= 0 ? headerIndex + 1 : 1; // skip possible summary row if header not found

    let processedRows = 0;
    let validRecords = 0;
    let skippedRows = 0;

    console.log(`Total rows in sheet: ${totalRows}`);
    console.log(`Header index: ${headerIndex}`);
    console.log(`Starting to parse at row (1-based): ${startIndex + 1}`);

    for (let i = startIndex; i < rows.length; i++) {
      const row = rows[i];
      processedRows++;

      if (!row || row.length === 0) {
        skippedRows++;
        continue;
      }

      const consultant = row[0] || '';
      const contractDate = this.parseDate(row[1] || '');
      const studentName = (row[2] || '').toString().trim();
      const specialCondition = row[3] || ''; // Condição especial
      const paymentMethod = row[4] || ''; // Forma de pagamento
      const installment = row[5] || ''; // Parcelas
      const dueDate = this.parseDate(row[6] || ''); // Vencimento
      const amount = this.parseAmount(row[7] || ''); // Valor da venda
      const fees = this.parseAmount(row[8] || ''); // Taxas descontadas
      const interest = this.parseAmount(row[9] || ''); // Juros recebidos
      const paymentDate = this.parseDate(row[10] || ''); // Data pagamento
      const status = this.parseStatus(row[11] || ''); // Status
      const invoice = row[12] || ''; // Número da nota fiscal
      const contractObservation = row[13] || ''; // Observação do contrato
      
      // Determinar se tem bolsa baseado na condição especial
      const scholarshipStudent = this.parseScholarship(specialCondition);

      if (i < startIndex + 5) {
        console.log(`Row ${i + 1}: Student='${studentName}', Amount=${amount}, Status='${status}'`);
      }

      // Require a student name and a positive amount; allow missing dates
      if (studentName && amount > 0) {
        records.push({
          id: `${i}`,
          consultant,
          contractDate,
          studentName,
          specialCondition,
          paymentMethod,
          installment,
          dueDate: dueDate || new Date().toISOString().split('T')[0],
          amount,
          fees: fees || 0,
          interest: interest || 0,
          paymentDate: paymentDate || undefined,
          status,
          invoice,
          contractObservation,
          scholarshipStudent,
        });
        validRecords++;
      } else {
        skippedRows++;
      }
    }

    console.log('Processing summary:');
    console.log(`- Total rows: ${totalRows}`);
    console.log(`- Processed rows: ${processedRows}`);
    console.log(`- Valid records: ${validRecords}`);
    console.log(`- Skipped rows: ${skippedRows}`);
    console.log(`- Total amount: R$ ${records.reduce((sum, r) => sum + r.amount, 0).toFixed(2)}`);

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

  private static parseBoolean(value: string): boolean {
    if (!value) return false;
    const cleanValue = value.toString().trim().toUpperCase();
    return cleanValue === 'SIM' || cleanValue === 'TRUE' || cleanValue === '1' || cleanValue === 'BOLSA';
  }

  private static parseScholarship(specialCondition: string): boolean {
    if (!specialCondition) return false;
    const cleanValue = specialCondition.toString().trim().toUpperCase();
    return cleanValue.includes('BOLSA') || cleanValue.includes('SCHOLARSHIP');
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
        record.consultant, // A
        this.formatDateForSheet(record.contractDate), // B
        record.studentName, // C
        record.specialCondition || '', // D
        record.paymentMethod || '', // E
        record.installment, // F
        this.formatDateForSheet(record.dueDate), // G
        `R$ ${record.amount.toFixed(2).replace('.', ',')}`, // H
        record.fees ? `R$ ${record.fees.toFixed(2).replace('.', ',')}` : '', // I
        record.interest ? `R$ ${record.interest.toFixed(2).replace('.', ',')}` : '', // J
        record.paymentDate ? this.formatDateForSheet(record.paymentDate) : '', // K
        record.status, // L
        record.invoice || '', // M
        record.contractObservation || '' // N
      ]);

      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/A8:N${8 + values.length - 1}?valueInputOption=RAW&key=${apiKey}`,
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