// ─── Telegram Bot Proxy ────────────────────────────────────────
// Принимает заявки с сайта и сообщения от Telegram-бота.
// @version 2

const BOT_TOKEN = PropertiesService.getScriptProperties().getProperty('TELEGRAM_BOT_TOKEN');
const CHAT_IDS = PropertiesService.getScriptProperties().getProperty('TELEGRAM_CHAT_IDS');
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    // ── Сообщение от Telegram-бота ────────────────────────────
    if (data.message && data.message.text) {
      const msg = data.message;
      const chatId = String(msg.chat.id);
      const from = msg.from || {};
      const username = from.username ? ` (@${from.username})` : '';
      const name = [from.first_name, from.last_name].filter(Boolean).join(' ') || 'Unknown';

      console.log(`[TG] chatId=${chatId}, name=${name}${username}, text="${msg.text}"`);

      // Автоматически добавляем chatId в список, если его там нет
      const props = PropertiesService.getScriptProperties();
      let chatIds = props.getProperty('TELEGRAM_CHAT_IDS') || '';
      const ids = chatIds.split(',').map(s => s.trim()).filter(Boolean);

      if (!ids.includes(chatId)) {
        ids.push(chatId);
        props.setProperty('TELEGRAM_CHAT_IDS', ids.join(','));
        console.log(`[TG] Added new chatId: ${chatId}`);

        // Уведомляем админов о новом подписчике
        ids.forEach(id => {
          if (id !== chatId) {
            try {
              UrlFetchApp.fetch(`${TELEGRAM_API}/sendMessage`, {
                method: 'post',
                contentType: 'application/json',
                payload: JSON.stringify({
                  chat_id: id,
                  text: `➕ <b>Новый подписчик!</b>\n\n👤 ${name}${username}\n🆔 <code>${chatId}</code>\n\nДобавлен автоматически.`,
                  parse_mode: 'HTML',
                }),
              });
            } catch (_) { }
          }
        });
      }

      // Отвечаем пользователю
      UrlFetchApp.fetch(`${TELEGRAM_API}/sendMessage`, {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify({
          chat_id: chatId,
          text: `👋 ${name}, вы подписаны на уведомления о заявках!`,
          parse_mode: 'HTML',
        }),
      });

      return ContentService
        .createTextOutput(JSON.stringify({ message: 'ok' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ── Заявка с сайта ────────────────────────────────────────
    const message = formatMessage(data);
    const chatIds = CHAT_IDS.split(',').map(s => s.trim()).filter(Boolean);

    chatIds.forEach(chatId => {
      try {
        UrlFetchApp.fetch(`${TELEGRAM_API}/sendMessage`, {
          method: 'post',
          contentType: 'application/json',
          payload: JSON.stringify({
            chat_id: chatId,
            text: message,
            parse_mode: 'HTML',
          }),
        });
      } catch (err) {
        console.error(`Failed to send to ${chatId}:`, err);
      }
    });

    return ContentService
      .createTextOutput(JSON.stringify({ message: 'ok' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (e) {
    return ContentService
      .createTextOutput(JSON.stringify({ message: 'error', error: e.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet() {
  return HtmlService.createHtmlOutput('Bot proxy is running!');
}

function formatMessage(data) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('ru-RU');
  const timeStr = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

  const type = data.type;

  if (type === 'call') {
    return [
      '📞 <b>Заявка на обратный звонок</b>',
      '',
      `👤 Имя: ${data.name || '—'}`,
      `📱 Телефон: ${data.phone || '—'}`,
      '',
      `🕐 ${dateStr} ${timeStr}`,
    ].join('\n');
  }

  if (type === 'full') {
    const lines = ['💰 <b>Заявка на расчёт стоимости</b>', ''];
    if (data.propertyType) lines.push(`🏠 Объект: ${data.propertyType}`);
    if (data.renovationType) lines.push(`🔧 Ремонт: ${data.renovationType}`);
    if (data.totalArea) lines.push(`📐 Площадь: ${data.totalArea} м²`);
    if (data.demolition) lines.push(`🪓 Демонтаж: ${data.demolition}`);
    if (data.hasBalcony) lines.push(`🪟 Балкон/лоджия: ${data.hasBalcony}`);
    if (data.replanning) lines.push(`📋 Перепланировка: ${data.replanning}`);
    if (data.height) lines.push(`📏 Высота потолков: ${data.height} м`);
    lines.push('');
    if (data.name) lines.push(`👤 Имя: ${data.name}`);
    if (data.phone) lines.push(`📱 Телефон: ${data.phone}`);
    lines.push('');
    lines.push(`🕐 ${dateStr} ${timeStr}`);
    return lines.join('\n');
  }

  return `❓ <b>Неизвестный тип запроса</b>\n\n${JSON.stringify(data, null, 2)}`;
}
