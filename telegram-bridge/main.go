package main

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"strings"

	"telegram-bridge/config"
	"telegram-bridge/telegram"
)

var tgClient *telegram.Client

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout,
		&slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(logger)

	cfg, err := config.Load()
	if err != nil {
		slog.Error("failed to load config", "error", err)
		os.Exit(1)
	}
	slog.Info("config loaded", "config", cfg)

	var clientErr error
	tgClient, clientErr = telegram.NewClient(
		cfg.TelegramBotToken,
		cfg.TelegramChatIDs,
		cfg.ProxyURL,
	)
	if clientErr != nil {
		slog.Error("failed to create telegram client", "error", clientErr)
		os.Exit(1)
	}

	mux := http.NewServeMux()

	// ── Эндпоинт для сайта (React-форма) ──────────────────────
	mux.HandleFunc("/api/request", withCORS(handleSiteRequest))

	// ── Эндпоинт для Telegram webhook ─────────────────────────
	mux.HandleFunc("/api/webhook", handleTelegramWebhook)

	// ── Healthcheck ───────────────────────────────────────────
	mux.HandleFunc("/api/health", handleHealth)

	slog.Info("server starting", "port", cfg.Port)
	if err := http.ListenAndServe(":"+cfg.Port, mux); err != nil {
		slog.Error("server failed", "error", err)
		os.Exit(1)
	}
}

// ─── CORS middleware ────────────────────────────────────────────

var allowedOrigins = map[string]bool{}

func init() {
	origins := os.Getenv("ALLOWED_ORIGINS")
	if origins == "" || origins == "*" {
		allowedOrigins["*"] = true
	} else {
		for _, o := range splitTrim(origins, ",") {
			allowedOrigins[o] = true
		}
	}
}

func withCORS(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if allowedOrigins["*"] {
			w.Header().Set("Access-Control-Allow-Origin", "*")
		} else if allowedOrigins[origin] {
			w.Header().Set("Access-Control-Allow-Origin", origin)
		}
		w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		next(w, r)
	}
}

// ─── Handlers ──────────────────────────────────────────────────

func handleSiteRequest(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var data map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
		http.Error(w, `{"message":"invalid json"}`, http.StatusBadRequest)
		return
	}

	reqType, _ := data["type"].(string)

	var message string
	switch reqType {
	case "call":
		name, _ := data["name"].(string)
		phone, _ := data["phone"].(string)
		message = telegram.FormatCallbackRequest(name, phone)
	case "full":
		strData := make(map[string]string)
		for k, v := range data {
			strData[k] = toString(v)
		}
		message = telegram.FormatPriceRequest(strData)
	default:
		message = "❓ <b>Неизвестный тип запроса</b>"
	}

	errs := tgClient.SendToAll(message)
	if len(errs) > 0 {
		slog.Error("some messages failed", "errors", errs)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "ok"})
}

func handleTelegramWebhook(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var update struct {
		Message struct {
			Chat struct {
				ID int64 `json:"id"`
			} `json:"chat"`
			Text string `json:"text"`
			From struct {
				ID        int64  `json:"id"`
				IsBot     bool   `json:"is_bot"`
				FirstName string `json:"first_name"`
				Username  string `json:"username"`
			} `json:"from"`
		} `json:"message"`
	}

	if err := json.NewDecoder(r.Body).Decode(&update); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	msg := update.Message
	if msg.Text == "" || msg.From.IsBot {
		w.WriteHeader(http.StatusOK)
		return
	}

	chatID := fmt.Sprintf("%d", msg.Chat.ID)
	slog.Info("telegram message", "chat_id", chatID, "text", msg.Text)

	trimmed := strings.TrimSpace(msg.Text)
	var replyText string
	switch {
	case trimmed == "/start":
		replyText = "Запрос отправлен"
		// TODO: сохранить пользователя в БД
	case strings.HasPrefix(trimmed, "/"):
		replyText = "Неизвестная команда. Используйте /start для регистрации"
	default:
		replyText = "Используйте /start для регистрации"
	}

	if replyText != "" {
		if err := tgClient.SendMessage(chatID, replyText); err != nil {
			slog.Error("failed to reply to user", "chat_id", chatID, "error", err)
		}
	}

	w.WriteHeader(http.StatusOK)
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

// ─── Helpers ────────────────────────────────────────────────────

func toString(v interface{}) string {
	if v == nil {
		return ""
	}
	if s, ok := v.(string); ok {
		return s
	}
	return fmt.Sprintf("%v", v)
}

func splitTrim(s, sep string) []string {
	parts := []string{}
	for _, p := range strings.Split(s, sep) {
		p = strings.TrimSpace(p)
		if p != "" {
			parts = append(parts, p)
		}
	}
	return parts
}
