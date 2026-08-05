// ─── Webhook management ──────────────────────────────────────────

/**
 * Устанавливает вебхук Telegram на URL из PropertiesService (WEBHOOK_URL).
 * Вызови из редактора Apps Script, выбрав функцию setTelegramWebhook и нажав "Run".
 */
function setTelegramWebhook() {
  const webhookUrl = getWebhookUrl();
  const apiUrl = `https://api.telegram.org/bot${getBotToken()}/setWebhook?url=${encodeURIComponent(webhookUrl)}`;
  const resp = UrlFetchApp.fetch(apiUrl);
  const result = JSON.parse(resp.getContentText());
  logToSheet('setWebhook', `url=${webhookUrl}, result=${JSON.stringify(result)}`);
  return result;
}

/**
 * Получает текущий статус вебхука.
 * Вызови из редактора Apps Script, выбрав функцию getWebhookInfo и нажав "Run".
 */
function getWebhookInfo() {
  const apiUrl = `https://api.telegram.org/bot${getBotToken()}/getWebhookInfo`;
  const resp = UrlFetchApp.fetch(apiUrl);
  const result = JSON.parse(resp.getContentText());
  logToSheet('getWebhookInfo', JSON.stringify(result));
  return result;
}

/**
 * Аварийная остановка: удаляет вебхук Telegram.
 * Вызови из редактора Apps Script, чтобы мгновенно остановить цикл сообщений.
 */
function deleteWebhook() {
  const apiUrl = `https://api.telegram.org/bot${getBotToken()}/deleteWebhook`;
  const resp = UrlFetchApp.fetch(apiUrl);
  const result = JSON.parse(resp.getContentText());
  logToSheet('deleteWebhook', JSON.stringify(result));
  return result;
}

/**
 * Очищает очередь pending updates.
 * Запрашивает getUpdates без offset, получает максимальный update_id,
 * затем делает запрос с offset = max_update_id + 1, что помечает все как прочитанные.
 * Вызови перед setTelegramWebhook, если вебхук был долго отключен.
 */
function clearUpdatesQueue() {
  // Получаем pending updates (без вебхука)
  const apiUrl = `https://api.telegram.org/bot${getBotToken()}/getUpdates`;
  const resp = UrlFetchApp.fetch(apiUrl);
  const data = JSON.parse(resp.getContentText());
  logToSheet('clearUpdatesQueue', `pending updates: ${(data.result || []).length}`);

  if (data.ok && data.result && data.result.length > 0) {
    const lastUpdateId = data.result[data.result.length - 1].update_id;
    // Помечаем все как прочитанные
    const confirmUrl = `${apiUrl}?offset=${lastUpdateId + 1}`;
    UrlFetchApp.fetch(confirmUrl);
    logToSheet('clearUpdatesQueue', `cleared up to update_id=${lastUpdateId}`);
  }
  return data;
}
