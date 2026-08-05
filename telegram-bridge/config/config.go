package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
)

type Config struct {
	TelegramBotToken string
	TelegramChatIDs  []string
	ProxyURL         string
	Port             string
	AllowedOrigins   []string
	RateLimit        int
	LogLevel         string
}

func Load() (*Config, error) {
	cfg := &Config{}

	cfg.TelegramBotToken = os.Getenv("TELEGRAM_BOT_TOKEN")
	if cfg.TelegramBotToken == "" {
		return nil, fmt.Errorf("TELEGRAM_BOT_TOKEN is required")
	}

	chatIDs := os.Getenv("TELEGRAM_CHAT_IDS")
	if chatIDs == "" {
		return nil, fmt.Errorf("TELEGRAM_CHAT_IDS is required (comma-separated list)")
	}
	cfg.TelegramChatIDs = splitAndTrim(chatIDs, ",")
	if len(cfg.TelegramChatIDs) == 0 {
		return nil, fmt.Errorf("TELEGRAM_CHAT_IDS must contain at least one chat ID")
	}

	cfg.ProxyURL = os.Getenv("PROXY_URL")

	cfg.Port = os.Getenv("PORT")
	if cfg.Port == "" {
		cfg.Port = "8080"
	}

	origins := os.Getenv("ALLOWED_ORIGINS")
	if origins == "" {
		origins = "*"
	}
	cfg.AllowedOrigins = splitAndTrim(origins, ",")

	rateStr := os.Getenv("RATE_LIMIT")
	if rateStr == "" {
		rateStr = "10"
	}
	rate, err := strconv.Atoi(rateStr)
	if err != nil {
		return nil, fmt.Errorf("invalid RATE_LIMIT: %w", err)
	}
	cfg.RateLimit = rate

	cfg.LogLevel = os.Getenv("LOG_LEVEL")
	if cfg.LogLevel == "" {
		cfg.LogLevel = "info"
	}

	return cfg, nil
}

func (c *Config) String() string {
	return fmt.Sprintf(
		"Config{Port: %s, ChatIDs: %v, Proxy: %s, RateLimit: %d, LogLevel: %s}",
		c.Port, c.TelegramChatIDs, c.ProxyURL, c.RateLimit, c.LogLevel,
	)
}

func splitAndTrim(s, sep string) []string {
	parts := strings.Split(s, sep)
	var result []string
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			result = append(result, p)
		}
	}
	return result
}
