// ─── doPost / doGet ────────────────────────────────────────────
// @version 8

function doPost(e) {
  // Выносим создание текстового ответа в отдельную переменную.
  // ContentService гарантирует корректные заголовки CORS для React-приложения.
  const successOutput = ContentService
    .createTextOutput(JSON.stringify({ status: 'ok', message: 'success' }))
    .setMimeType(ContentService.MimeType.JSON);

  try {
    const data = JSON.parse(e.postData.contents);

    // ── Вебхук от Telegram (бот) ──────────────────────────────
    if (data.message && data.message.text) {
      const msg = data.message;
      const chatId = msg.chat.id;
      const text = msg.text.trim();
      const isBot = msg.from && msg.from.is_bot;

      if (isBot) return successOutput;

      // Логируем безопасно
      try {
        logToSheet('tg:msg', `chatId=${chatId}, text="${text}"`);
      } catch (err) {
        console.error('Logging failed:', err);
      }

      // Определяем ответ
      let replyText;
      if (text === '/start') {
        try {
          const existing = findUserBySheet(chatId);
          if (existing) {
            replyText = 'Запрос уже был отправлен';
          } else {
            addUserToSheet(msg.from);
            replyText = 'Запрос отправлен';
          }
        } catch (sheetErr) {
          console.error('Sheet operations failed:', sheetErr);
          replyText = 'Произошла ошибка при работе с базой данных.';
        }
      } else {
        replyText = 'Используйте /start для регистрации';
      }

      // Отправляем сообщение в Telegram через UrlFetchApp
      try {
        sendMessage(chatId, replyText);
      } catch (sendErr) {
        console.error('sendMessage failed:', sendErr);
      }

      return successOutput;
    }

    // ── Запрос с сайта (React / Localhost) ─────────────────────
    let message;
    switch (data.type) {
      case 'call': message = getCallbackRequest(data); break;
      case 'full': message = getPriceRequest(data); break;
      default: message = `❓ <b>Неизвестный тип запроса</b>\n\n${JSON.stringify(data, null, 2)}`;
    }

    try {
      const users = getAllUsersWithAccess();
      if (users) {
        users.forEach(u => {
          try { sendMessage(u.userId || u.id, message); }
          catch (err) { console.error(`Failed to send to ${u.userId || u.id}:`, err); }
        });
      }
    } catch (err) {
      console.error('Failed to get users with access:', err);
    }

    return successOutput;

  } catch (e) {
    try { logToSheet('doPost:CRITICAL_ERROR', e.toString()); } catch (_) { }
    // В случае ошибки всё равно отдаем JSON со статусом 200
    return successOutput;
  }
}

function doGet() {
  return HtmlService.createHtmlOutput('Bot is running!');
}
