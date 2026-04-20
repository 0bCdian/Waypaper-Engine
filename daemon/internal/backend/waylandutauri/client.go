package waylandutauri

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"strings"
	"time"
)

const localHTTPBaseURL = "http://wayland-utauri.local"

type controlClient struct {
	httpClient      *http.Client
	baseURL         string
	expectedService string
	expectedAPI     string
}

func newControlClient(cfg *Config) (*controlClient, error) {
	if strings.TrimSpace(cfg.SocketPath) == "" {
		return nil, fmt.Errorf("%w: empty socket path", errUnavailable)
	}

	transport := &http.Transport{
		DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
			var d net.Dialer
			return d.DialContext(ctx, "unix", cfg.SocketPath)
		},
	}

	timeout := time.Duration(cfg.RequestTimeoutMS) * time.Millisecond
	if timeout <= 0 {
		timeout = 1500 * time.Millisecond
	}

	return &controlClient{
		httpClient: &http.Client{
			Transport: transport,
			Timeout:   timeout,
		},
		baseURL:         localHTTPBaseURL,
		expectedService: cfg.ExpectedService,
		expectedAPI:     cfg.ExpectedAPIVersion,
	}, nil
}

func (c *controlClient) checkHealth(ctx context.Context) error {
	var payload struct {
		OK         bool   `json:"ok"`
		Service    string `json:"service"`
		APIVersion string `json:"api_version"`
	}
	headers, status, body, err := c.doJSON(ctx, http.MethodGet, "/health", nil)
	if err != nil {
		return fmt.Errorf("%w: %v", errUnavailable, err)
	}
	if status < 200 || status >= 300 {
		return classifyHTTPError(status, body)
	}
	if err := json.Unmarshal([]byte(body), &payload); err != nil {
		return fmt.Errorf("%w: decode health response: %v", errContract, err)
	}
	if !payload.OK {
		return fmt.Errorf("%w: health returned ok=false", errContract)
	}
	if c.expectedService != "" && payload.Service != c.expectedService {
		return fmt.Errorf("%w: service %q does not match expected %q", errContract, payload.Service, c.expectedService)
	}
	respAPI := strings.TrimSpace(headers.Get("X-API-Version"))
	if respAPI == "" {
		respAPI = payload.APIVersion
	}
	if c.expectedAPI != "" && respAPI != c.expectedAPI {
		return fmt.Errorf("%w: api version %q does not match expected %q (align backend.wayland-utauri.expected_api_version with GET /health)", errContract, respAPI, c.expectedAPI)
	}
	return nil
}

func (c *controlClient) status(ctx context.Context) (*statusResponse, error) {
	_, status, body, err := c.doJSON(ctx, http.MethodGet, "/wallpaper/status", nil)
	if err != nil {
		return nil, err
	}
	if status < 200 || status >= 300 {
		return nil, classifyHTTPError(status, body)
	}
	var resp statusResponse
	if err := json.Unmarshal([]byte(body), &resp); err != nil {
		return nil, fmt.Errorf("%w: decode status response: %v", errContract, err)
	}
	if !resp.OK {
		return nil, fmt.Errorf("%w: status returned ok=false", errContract)
	}
	return &resp, nil
}

func (c *controlClient) load(ctx context.Context, req loadRequest) (int, string, error) {
	_, status, body, err := c.doJSON(ctx, http.MethodPost, "/wallpaper/load", req)
	return status, body, err
}

func (c *controlClient) setAllowNetworkWallpapers(ctx context.Context, allow bool) error {
	_, status, body, err := c.doJSON(ctx, http.MethodPost, "/settings/network", map[string]any{
		"allow_network_wallpapers": allow,
	})
	if err != nil {
		return err
	}
	if status < 200 || status >= 300 {
		return classifyHTTPError(status, body)
	}
	return nil
}

func (c *controlClient) setImagePresentation(ctx context.Context, fit, rendering string) error {
	_, status, body, err := c.doJSON(ctx, http.MethodPost, "/settings/image-presentation", map[string]string{
		"image_fit_mode":  fit,
		"image_rendering": rendering,
	})
	if err != nil {
		return err
	}
	if status < 200 || status >= 300 {
		return classifyHTTPError(status, body)
	}
	return nil
}

func (c *controlClient) pushWallpaperConfig(ctx context.Context, sourceTarget string, valuesJSON json.RawMessage) error {
	var values any = map[string]any{}
	if len(valuesJSON) > 0 {
		if err := json.Unmarshal(valuesJSON, &values); err != nil {
			return fmt.Errorf("decode wallpaper config values: %w", err)
		}
	}
	_, status, body, err := c.doJSON(ctx, http.MethodPost, "/wallpaper/wallpaper-config", map[string]any{
		"source_target": sourceTarget,
		"values":        values,
	})
	if err != nil {
		return err
	}
	if status < 200 || status >= 300 {
		return classifyHTTPError(status, body)
	}
	return nil
}

func (c *controlClient) pushWebCapabilities(ctx context.Context, sourceTarget string, capsJSON json.RawMessage) error {
	var caps any = map[string]any{}
	if len(capsJSON) > 0 {
		if err := json.Unmarshal(capsJSON, &caps); err != nil {
			return fmt.Errorf("decode web capabilities: %w", err)
		}
	}
	_, status, body, err := c.doJSON(ctx, http.MethodPost, "/wallpaper/web-capabilities", map[string]any{
		"source_target": sourceTarget,
		"capabilities":  caps,
	})
	if err != nil {
		return err
	}
	if status < 200 || status >= 300 {
		return classifyHTTPError(status, body)
	}
	return nil
}

func (c *controlClient) setParallax(ctx context.Context, body map[string]any) error {
	_, status, respBody, err := c.doJSON(ctx, http.MethodPost, "/wallpaper/parallax", body)
	if err != nil {
		return err
	}
	if status < 200 || status >= 300 {
		return classifyHTTPError(status, respBody)
	}
	return nil
}

// parallaxMove posts to POST /wallpaper/parallax-move. direction must be left, right, up, or down.
func (c *controlClient) parallaxMove(ctx context.Context, direction string, amountPercent *float64, outputName *string) error {
	switch direction {
	case "left", "right", "up", "down":
	default:
		return fmt.Errorf("parallaxMove: invalid direction %q", direction)
	}
	body := map[string]any{"direction": direction}
	if amountPercent != nil {
		body["amount_percent"] = *amountPercent
	}
	if outputName != nil {
		body["name"] = *outputName
	}
	_, status, respBody, err := c.doJSON(ctx, http.MethodPost, "/wallpaper/parallax-move", body)
	if err != nil {
		return err
	}
	if status < 200 || status >= 300 {
		return classifyHTTPError(status, respBody)
	}
	return nil
}

// parallaxMoveScoped is used by the workspace compositor driver and always scopes
// movement to one resolved monitor.
func (c *controlClient) parallaxMoveScoped(ctx context.Context, direction string, amountPercent float64, outputName string) error {
	return c.parallaxMove(ctx, direction, &amountPercent, &outputName)
}

func (c *controlClient) doJSON(ctx context.Context, method, path string, payload any) (http.Header, int, string, error) {
	var bodyReader io.Reader
	if payload != nil {
		raw, err := json.Marshal(payload)
		if err != nil {
			return nil, 0, "", fmt.Errorf("marshal request: %w", err)
		}
		bodyReader = bytes.NewReader(raw)
	}

	req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, bodyReader)
	if err != nil {
		return nil, 0, "", fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, 0, "", err
	}
	defer resp.Body.Close()

	rawBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return resp.Header, resp.StatusCode, "", fmt.Errorf("read response: %w", err)
	}

	return resp.Header, resp.StatusCode, strings.TrimSpace(string(rawBody)), nil
}
