// ─── Форматирование сообщений ──────────────────────────────────

function getCallbackRequest(data) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  return `📞 <b>Заявка на обратный звонок</b>\n\n` +
    `👤 Имя: ${data.name}\n📱 Телефон: ${data.phone}\n\n🕐 ${dateStr} ${timeStr}`;
}

function getPriceRequest(data) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  return `💰 <b>Заявка на расчёт стоимости</b>\n\n` +
    `🏠 Объект: ${data.propertyType || '—'}\n` +
    `🔧 Ремонт: ${data.renovationType || '—'}\n` +
    `📐 Площадь: ${data.totalArea || '—'} м²\n` +
    (data.demolition ? `🪓 Демонтаж: ${data.demolition}\n` : '') +
    (data.hasBalcony ? `🪟 Балкон/лоджия: ${data.hasBalcony}\n` : '') +
    (data.replanning ? `📋 Перепланировка: ${data.replanning}\n` : '') +
    (data.height ? `📏 Высота потолков: ${data.height} м\n` : '') +
    `👤 Имя: ${data.name}\n📱 Телефон: ${data.phone}\n\n🕐 ${dateStr} ${timeStr}`;
}
