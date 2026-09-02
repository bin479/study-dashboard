const { downloadXlsx } = require('./lib/googleDrive');
const XLSX = require('xlsx');

exports.handler = async (event) => {
  try {
    const buffer = await downloadXlsx(process.env.GOOGLE_DRIVE_FILE_ID);
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    
    return { statusCode: 200, body: JSON.stringify({ sheets: workbook.SheetNames }) };
  } catch (e) {
    return { statusCode: 500, body: e.message };
  }
};
