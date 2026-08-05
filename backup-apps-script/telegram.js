// ─── Telegram API ───────────────────────────────────────────────

const getBotToken = () => {
  return PropertiesService.getScriptProperties().getProperty('TELEGRAM_BOT_TOKEN');
};

const getWebhookUrl = () => {
  return PropertiesService.getScriptProperties().getProperty('WEBHOOK_URL');
};

const getTelegramUrl = () => `https://api.telegram.org/bot${getBotToken()}`;

const sendMessage = (chatId, text) => {
  const data = {
    method: 'post',
    payload: {
      method: 'sendMessage',
      chat_id: String(chatId),
      text,
      parse_mode: 'HTML',
    },
  };
  try {
    const resp = UrlFetchApp.fetch(getTelegramUrl() + '/', data);
    const result = JSON.parse(resp.getContentText());
    if (!result.ok) {
      logToSheet('sendMessage:ERROR', `chatId=${chatId}, error_code=${result.error_code}, description=${result.description}`);
    } else {
      logToSheet('sendMessage:ok', `chatId=${chatId}`);
    }
  } catch (err) {
    logToSheet('sendMessage:EXCEPTION', `chatId=${chatId}, error=${err.message}`);
  }
};
