const { downloadXlsx } = require('./lib/googleDrive');
const XLSX = require('xlsx');

exports.handler = async (event) => {
  try {
    const buffer = await downloadXlsx(process.env.GOOGLE_DRIVE_FILE_ID);
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames.find(n => n.includes('학습부배정') || n.includes('학습부 배정'));
    const sheet = workbook.Sheets[sheetName];
    const cell = sheet['K4']; // K4 is Wednesday 1교시
    
    const val = cell ? cell.v : 'undefined';
    const charCodes = String(val).split('').map(c => c.charCodeAt(0)).join(', ');
    
    return { statusCode: 200, body: JSON.stringify({ val: String(val), charCodes }) };
  } catch (e) {
    return { statusCode: 500, body: e.message };
  }
};
