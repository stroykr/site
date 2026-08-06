# Архитектура отправки заявок в Telegram

## Текущее состояние

### Поток данных

```
ReactModal.tsx (браузер)
  │  POST JSON { name, phone, type: "call" }
  │  Content-Type: text/plain;charset=utf-8 (обход CORS preflight)
  ▼
Google Apps Script
  │  Парсит JSON
  │  Формирует сообщение
  │  Отправляет через Telegram Bot API (sendMessage)
  ▼
Telegram чат (менеджер получает уведомление)
```

### Проблемы

| Проблема                             | Риск                                            |
| ------------------------------------ | ----------------------------------------------- |
| Google Apps Script падает (инстансы) | Высокий — уже случалось                         |
| Google может быть заблокирован в РФ  | Средний — script.google.com перестанет работать |
| Нет мониторинга / логов              | Высокий — нельзя понять, что упало              |
| Зависимость от двух внешних сервисов | Средний                                         |

### Критические переменные окружения

- `TELEGRAM_BOT_TOKEN` — токен бота
- `TELEGRAM_CHAT_ID` — ID чата/пользователя, куда шлём уведомления

---

## Предлагаемое решение: Go-сервер

### Вариант A: Go-сервер на cloud.ru с прокси для Telegram

```
ReactModal.tsx → POST → Go-сервер (cloud.ru) → SOCKS5/HTTP прокси → Telegram API
```

**Плюсы:**

- Полный контроль над кодом
- Нет зависимости от Google
- Можно добавить логирование, мониторинг, retry

**Минусы:**

- Нужен прокси/VPN для доступа к Telegram API из РФ (mtproto прокси или SOCKS5)
- Нужно платить за cloud.ru
- Нужно настраивать сертификаты, домен

### Вариант B: Go-сервер за пределами РФ (Hetzner, DigitalOcean и т.п.)

```
ReactModal.tsx → POST → Go-сервер (EU) → Telegram API (напрямую)
```

**Плюсы:**

- Прямой доступ к Telegram API, не нужен прокси
- Проще настройка

**Минусы:**

- Выше latency для пользователей из РФ (~50-100ms RTT)
- Зарубежный хостинг может быть заблокирован РКН
- Оплата в валюте

### Вариант C: Cloudflare Workers (serverless)

```
ReactModal.tsx → POST → Cloudflare Worker → Telegram API
```

**Плюсы:**

- Бесплатный тир (100k запросов/день)
- Не блокируется в РФ
- Доступ к Telegram API через Cloudflare сеть
- Не нужно поддерживать сервер

**Минусы:**

- JavaScript/TypeScript, не Go
- Ограничения serverless (время выполнения, размер)

---

## Рекомендованная архитектура (Вариант A)

### Компоненты

```
┌─────────────────────────────────────────────────┐
│                  GitHub Pages                    │
│  ┌───────────────────────────────────────────┐  │
│  │         Astro static site                 │  │
│  │  ReactModal.tsx                           │  │
│  │    │ POST /api/request                    │  │
│  └────┼──────────────────────────────────────┘  │
└───────┼─────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────┐
│              cloud.ru (Go-сервер)                │
│  ┌───────────────────────────────────────────┐  │
│  │  HTTP server (:8080)                      │  │
│  │  │                                        │  │
│  │  ├─ POST /api/request                     │  │
│  │  │   ├─ Валидация (name, phone)           │  │
│  │  │   ├─ Rate limiting (по IP)             │  │
│  │  │   ├─ Формирование сообщения             │  │
│  │  │   └─ Отправка в Telegram               │  │
│  │  │                                        │  │
│  │  └─ GET /health                           │  │
│  │                                        │    │
│  │  Telegram Client                          │  │
│  │    └─ HTTP + SOCKS5 прокси                │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
        │
        │ SOCKS5/HTTP прокси (или MTProto)
        ▼
┌─────────────────────────────────────────────────┐
│              Telegram Bot API                    │
│           api.telegram.org:443                   │
└─────────────────────────────────────────────────┘
```

### Структура Go-проекта

```
telegram-bridge/
├── main.go              # Точка входа, HTTP сервер
├── go.mod
├── go.sum
├── config/
│   └── config.go        # Загрузка конфига из env vars
├── handler/
│   └── request.go       # HTTP handler для POST /api/request
├── telegram/
│   └── client.go        # Клиент для Telegram Bot API (с прокси)
├── middleware/
│   └── ratelimit.go     # Rate limiting middleware
├── model/
│   └── request.go       # Модель данных заявки
├── Dockerfile           # Сборка контейнера
└── docker-compose.yml   # Для локальной разработки
```

### API спецификация

**POST /api/request**

Request:

```json
{
  "name": "Иван",
  "phone": "79261234567",
  "type": "call"
}
```

Response (200):

```json
{
  "message": "ok"
}
```

Response (400 - validation error):

```json
{
  "error": "name is required"
}
```

Response (429 - rate limit):

```json
{
  "error": "too many requests"
}
```

Response (502 - Telegram error):

```json
{
  "error": "failed to send telegram message"
}
```

### Переменные окружения

| Переменная           | Описание                 | Пример                          |
| -------------------- | ------------------------ | ------------------------------- |
| `TELEGRAM_BOT_TOKEN` | Токен бота               | `123456:ABC-DEF1234gh...`       |
| `TELEGRAM_CHAT_ID`   | ID чата для уведомлений  | `-1001234567890`                |
| `PROXY_URL`          | Адрес SOCKS5/HTTP прокси | `socks5://user:pass@proxy:1080` |
| `PORT`               | Порт HTTP сервера        | `8080`                          |
| `ALLOWED_ORIGINS`    | CORS origins             | `https://stroykr.ru`            |
| `RATE_LIMIT`         | Макс запросов в минуту   | `5`                             |
| `LOG_LEVEL`          | Уровень логирования      | `info`                          |

### Сообщение в Telegram

```markdown
📞 _Новая заявка на звонок_

👤 Имя: Иван
📱 Телефон: +7 (926) 123-45-67
🕐 Время: 05.08.2026 12:30

Тип: заказ обратного звонка
```

### Прокси для Telegram из РФ

Варианты:

1. **SOCKS5 прокси** — поднимается отдельно (например, outline или свой сервер за границей)
2. **MTProto прокси** — нативный прокси Telegram, можно поднять на том же cloud.ru
3. **HTTP прокси** — простой вариант, но медленнее

Рекомендация: использовать SOCKS5 прокси на отдельном дешёвом VPS за границей (€3-5/мес).

### Изменения на фронтенде

В [`global_settings.json`](src/data/global_settings.json) поменять `requestUrl`:

```json
{
  "variables": {
    "requestUrl": "https://api.stroykr.ru/api/request"
  }
}
```

Или если домена нет, напрямую на cloud.ru:

```json
{
  "requestUrl": "https://my-app.cloud.ru/api/request"
}
```

### Запасной план (fallback)

Если Go-сервер недоступен, можно добавить резервный канал:

1. Оставить Google Apps Script как fallback (временно)
2. Или добавить email-отправку через EmailJS / Resend

Фронтенд может пробовать сначала Go-сервер, затем fallback:

```typescript
try {
  await fetch(primaryUrl, ...)
} catch {
  await fetch(fallbackUrl, ...)
}
```

---

## Сравнение вариантов

| Критерий              | Google Apps Script | Go + cloud.ru   | Cloudflare Workers       |
| --------------------- | ------------------ | --------------- | ------------------------ |
| Надёжность            | ⭐⭐               | ⭐⭐⭐⭐        | ⭐⭐⭐⭐⭐               |
| Блокировка в РФ       | ⚠️ Google          | ⚠️ Нужен прокси | ✅ Не блокируется        |
| Стоимость             | Бесплатно          | ~500-1000₽/мес  | Бесплатно (до 100k/день) |
| Сложность             | ⭐ (просто)        | ⭐⭐⭐          | ⭐⭐                     |
| Go                    | ❌ (JS)            | ✅              | ❌ (JS)                  |
| Мониторинг            | ❌                 | ✅              | ✅                       |
| Зависимость от Google | Да                 | Нет             | Нет (частично)           |

---

## Итоговая рекомендация

**Рекомендую вариант C (Cloudflare Workers)** как самый простой и устойчивый к блокировкам:

- Бесплатно
- Не блокируется в РФ
- Прямой доступ к Telegram API (через CF сеть)
- Serverless — не нужно поддерживать сервер
- Можно написать на TypeScript (тот же язык, что и фронтенд)

Если принципиально нужен Go — **вариант A (cloud.ru + прокси)**.

---

## Необходимые данные для реализации

Для реализации любого варианта нужны:

- [ ] `TELEGRAM_BOT_TOKEN` — токен бота
- [ ] `TELEGRAM_CHAT_ID` — ID чата/пользователя
- [ ] Код Google Apps Script (чтобы понять формат сообщения и логику)

Без этих данных нельзя реализовать ни один вариант — рекомендую сначала экспортировать код Apps Script через clasp.
