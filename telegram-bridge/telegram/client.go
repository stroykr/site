package telegram

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type Client struct {
	botToken  string
	chatIDs   []string
	proxyURL  string
	httpClient *http.Client
}

type sendMessageRequest struct {
	ChatID    string `json:"chat_id"`
	Text      string `json:"text"`
	ParseMode string `json:"parse_mode"`
}

type telegramResponse struct {
	OK          bool   `json:"ok"`
	ErrorCode   int    `json:"error_code,omitempty"`
	Description string `json:"description,omitempty"`
}

func NewClient(botToken string, chatIDs []string, proxyURL string) (*Client, error) {
	client := &Client{
		botToken: botToken,
		chatIDs:  chatIDs,
		proxyURL: proxyURL,
	}

	transport := &http.Transport{}

	if proxyURL != "" {
		proxy, err := url.Parse(proxyURL)
		if err != nil {
			return nil, fmt.Errorf("invalid proxy URL: %w", err)
		}
		transport.Proxy = http.ProxyURL(proxy)
	}

	client.httpClient = &http.Client{
		Transport: transport,
		Timeout:   10 * time.Second,
	}

	return client, nil
}

func (c *Client) SendMessage(chatID, message string) error {
	return c.sendMessage(chatID, message)
}

func (c *Client) SendToAll(message string) []error {
	var errs []error
	for _, chatID := range c.chatIDs {
		if err := c.sendMessage(chatID, message); err != nil {
			slog.Error("failed to send telegram message", "chat_id", chatID, "error", err)
			errs = append(errs, fmt.Errorf("chat %s: %w", chatID, err))
		}
	}
	return errs
}

func (c *Client) sendMessage(chatID, text string) error {
	apiURL := fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", c.botToken)

	body := sendMessageRequest{
		ChatID:    chatID,
		Text:      text,
		ParseMode: "HTML",
	}

	jsonBody, err := json.Marshal(body)
	if err != nil {
		return fmt.Errorf("marshal request: %w", err)
	}

	resp, err := c.httpClient.Post(apiURL, "application/json", bytes.NewReader(jsonBody))
	if err != nil {
		return fmt.Errorf("http request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("read response: %w", err)
	}

	var tgResp telegramResponse
	if err := json.Unmarshal(respBody, &tgResp); err != nil {
		return fmt.Errorf("unmarshal response: %w (body: %s)", err, string(respBody))
	}

	if !tgResp.OK {
		return fmt.Errorf("telegram error %d: %s", tgResp.ErrorCode, tgResp.Description)
	}

	return nil
}

func FormatCallbackRequest(name, phone string) string {
	now := time.Now().In(time.FixedZone("MSK", 3*60*60))
	dateStr := now.Format("02.01.2006")
	timeStr := now.Format("15:04")

	return strings.Join([]string{
		"📞 <b>Заявка на обратный звонок</b>",
		"",
		fmt.Sprintf("👤 Имя: %s", name),
		fmt.Sprintf("📱 Телефон: %s", phone),
		"",
		fmt.Sprintf("🕐 %s %s", dateStr, timeStr),
	}, "\n")
}

func FormatPriceRequest(data map[string]string) string {
	now := time.Now().In(time.FixedZone("MSK", 3*60*60))
	dateStr := now.Format("02.01.2006")
	timeStr := now.Format("15:04")

	var b strings.Builder
	b.WriteString("💰 <b>Заявка на расчёт стоимости</b>\n\n")

	fields := []struct{ Label, Key string }{
		{"🏠 Объект", "propertyType"},
		{"🔧 Ремонт", "renovationType"},
	}
	for _, f := range fields {
		val := data[f.Key]
		if val == "" {
			val = "—"
		}
		b.WriteString(fmt.Sprintf("%s: %s\n", f.Label, val))
	}

	if v := data["totalArea"]; v != "" {
		b.WriteString(fmt.Sprintf("📐 Общая площадь: %s м²\n", v))
	}
	if v := data["demolition"]; v != "" {
		b.WriteString(fmt.Sprintf("🪓 Демонтаж: %s\n", v))
	}
	if v := data["hasBalcony"]; v != "" {
		b.WriteString(fmt.Sprintf("🪟 Балкон/лоджия: %s\n", v))
	}
	if v := data["replanning"]; v != "" {
		b.WriteString(fmt.Sprintf("📋 Перепланировка: %s\n", v))
	}
	if v := data["height"]; v != "" {
		b.WriteString(fmt.Sprintf("📏 Высота потолков: %s м\n", v))
	}

	b.WriteString(fmt.Sprintf("\n👤 Имя: %s\n", data["name"]))
	b.WriteString(fmt.Sprintf("📱 Телефон: %s\n", data["phone"]))
	b.WriteString(fmt.Sprintf("\n🕐 %s %s", dateStr, timeStr))
	return b.String()
}
