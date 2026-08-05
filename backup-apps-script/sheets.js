// ─── Работа с Google Sheets ────────────────────────────────────

const SPREADSHEET = SpreadsheetApp.getActiveSpreadsheet();
const USERS_SHEET_NAME = 'users';
const LOGS_SHEET_NAME = '_logs';

/** Возвращает лист по имени или создаёт его, если отсутствует. */
function getOrCreateSheet(sheetName, headers) {
  let sheet = SPREADSHEET.getSheetByName(sheetName);
  if (!sheet) {
    sheet = SPREADSHEET.insertSheet(sheetName);
    if (headers && headers.length > 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
  }
  return sheet;
}

/** Запись лога в лист _logs */
function logToSheet(event, detail) {
  try {
    const sheet = getOrCreateSheet(LOGS_SHEET_NAME, ['timestamp', 'event', 'detail']);
    const lastRow = sheet.getLastRow();
    sheet.getRange(lastRow + 1, 1, 1, 3).setValues([[
      new Date().toLocaleString('ru-RU'),
      String(event),
      String(detail),
    ]]);
  } catch (e) {
    // Не можем логировать ошибку логирования — просто игнорируем
  }
}

function findUserBySheet(userId) {
  const sheet = SPREADSHEET.getSheetByName(USERS_SHEET_NAME);
  if (!sheet) {
    logToSheet('findUserBySheet:sheet_not_found', `Sheet "${USERS_SHEET_NAME}" does not exist`);
    return null;
  }
  const lastRow = sheet.getLastRow();
  if (lastRow <= 2) {
    logToSheet('findUserBySheet:empty', `lastRow=${lastRow}, no user rows`);
    return null;
  }
  const headers = sheet.getRange(2, 1, 1, sheet.getLastColumn()).getValues()[0];
  const textFinder = sheet.getRange(3, 1, lastRow - 1, 1)
    .createTextFinder(String(userId))
    .matchEntireCell(true)
    .findNext();
  if (!textFinder) {
    logToSheet('findUserBySheet:not_found', `userId=${userId} not found in sheet`);
    return null;
  }
  const rowNum = textFinder.getRow();
  const rowData = sheet.getRange(rowNum, 1, 1, headers.length).getValues()[0];
  const obj = {};
  headers.forEach((h, i) => { obj[h] = rowData[i]; });
  logToSheet('findUserBySheet:found', `userId=${userId} found at row ${rowNum}`);
  return obj;
}

function addUserToSheet(user) {
  const sheet = getOrCreateSheet(USERS_SHEET_NAME,
    ['userId', 'first_name', 'last_name', 'username', 'language_code', 'is_bot', 'registeredAt', 'hasAccess']);
  const lastRow = sheet.getLastRow();
  const newRow = lastRow + 1;
  sheet.getRange(newRow, 1, 1, 8).setValues([[
    String(user.id),
    user.first_name || '',
    user.last_name || '',
    user.username || '',
    user.language_code || '',
    user.is_bot || false,
    new Date().toLocaleString('ru-RU'),
    false, // hasAccess
  ]]);
  logToSheet('addUserToSheet:ok', `userId=${user.id}, first_name=${user.first_name || ''}, row=${newRow}`);
}

function getAllUsersWithAccess() {
  const sheet = SPREADSHEET.getSheetByName(USERS_SHEET_NAME);
  if (!sheet) return null;
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  if (lastRow <= 2) return null;
  const headers = sheet.getRange(2, 1, 1, lastColumn).getValues()[0];
  const userData = sheet.getRange(3, 1, lastRow - 2, lastColumn).getValues();
  const hasAccessIndex = headers.indexOf('hasAccess');
  if (hasAccessIndex === -1) return null;
  const filtered = userData.filter(row => row[hasAccessIndex] === true);
  if (filtered.length === 0) return null;
  return filtered.map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i]; });
    return obj;
  });
}
