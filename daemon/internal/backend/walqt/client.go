package walqt

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"waypaper-engine/daemon/internal/backend/walqt/transport"
	"waypaper-engine/daemon/internal/backend/walqt/walqtclient"
)

const localHTTPBaseURL = "http://wal-qt.local"

// controlClient wraps the generated walqtclient.Client, providing the same
// method signatures that walqt.go relies on. All HTTP plumbing (Unix socket
// transport, request building, response decoding) is delegated to the
// generated client — this layer only translates between the engine's internal
// types and the generated request/response types.
type controlClient struct {
	// gen is the generated client used for every call except /wallpaper/load.
	gen *walqtclient.Client
	// genLoad uses the same socket but no Client.Timeout so context governs.
	genLoad         *walqtclient.Client
	loadTimeout     time.Duration
	expectedService string
	expectedAPI     string
}

func newControlClient(cfg *Config) (*controlClient, error) {
	if strings.TrimSpace(cfg.SocketPath) == "" {
		return nil, fmt.Errorf("%w: empty socket path", errUnavailable)
	}

	timeout := time.Duration(cfg.RequestTimeoutMS) * time.Millisecond
	if timeout <= 0 {
		timeout = 1500 * time.Millisecond
	}
	loadTimeout := time.Duration(cfg.LoadTimeoutMS) * time.Millisecond
	if loadTimeout <= 0 {
		loadTimeout = 15000 * time.Millisecond
	}

	httpClient := transport.NewClient(cfg.SocketPath, timeout)
	httpLoadClient := transport.NewClientNoTimeout(cfg.SocketPath)

	gen, err := walqtclient.NewClient(localHTTPBaseURL, walqtclient.WithHTTPClient(httpClient))
	if err != nil {
		return nil, fmt.Errorf("%w: create api client: %v", errUnavailable, err)
	}
	genLoad, err := walqtclient.NewClient(localHTTPBaseURL, walqtclient.WithHTTPClient(httpLoadClient))
	if err != nil {
		return nil, fmt.Errorf("%w: create load api client: %v", errUnavailable, err)
	}

	return &controlClient{
		gen:             gen,
		genLoad:         genLoad,
		loadTimeout:     loadTimeout,
		expectedService: cfg.ExpectedService,
		expectedAPI:     cfg.ExpectedAPIVersion,
	}, nil
}

// readBody drains and closes resp.Body, returning the trimmed body string.
func readBody(resp *http.Response) (string, error) {
	defer resp.Body.Close()
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("read response: %w", err)
	}
	return strings.TrimSpace(string(raw)), nil
}

func (c *controlClient) checkHealth(ctx context.Context) error {
	resp, err := c.gen.GetHealth(ctx)
	if err != nil {
		return fmt.Errorf("%w: %v", errUnavailable, err)
	}
	body, err := readBody(resp)
	if err != nil {
		return fmt.Errorf("%w: %v", errUnavailable, err)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return classifyHTTPError(resp.StatusCode, body)
	}
	var payload walqtclient.HealthResponse
	if err := json.Unmarshal([]byte(body), &payload); err != nil {
		return fmt.Errorf("%w: decode health response: %v", errContract, err)
	}
	if !payload.Ok {
		return fmt.Errorf("%w: health returned ok=false", errContract)
	}
	if c.expectedService != "" && payload.Service != c.expectedService {
		return fmt.Errorf("%w: service %q does not match expected %q", errContract, payload.Service, c.expectedService)
	}
	respAPI := strings.TrimSpace(resp.Header.Get("X-API-Version"))
	if respAPI == "" {
		respAPI = payload.ApiVersion
	}
	if c.expectedAPI != "" && respAPI != c.expectedAPI {
		return fmt.Errorf("%w: api version %q does not match expected %q (align backend.wal-qt.expected_api_version with GET /health)", errContract, respAPI, c.expectedAPI)
	}
	return nil
}

func (c *controlClient) status(ctx context.Context) (*statusResponse, error) {
	resp, err := c.gen.GetWallpaperStatus(ctx)
	if err != nil {
		return nil, err
	}
	body, err := readBody(resp)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, classifyHTTPError(resp.StatusCode, body)
	}
	var sr statusResponse
	if err := json.Unmarshal([]byte(body), &sr); err != nil {
		return nil, fmt.Errorf("%w: decode status response: %v", errContract, err)
	}
	if !sr.OK {
		return nil, fmt.Errorf("%w: status returned ok=false", errContract)
	}
	return &sr, nil
}

func (c *controlClient) load(ctx context.Context, req loadRequest) (int, string, error) {
	loadCtx, cancel := context.WithTimeout(ctx, c.loadTimeout)
	defer cancel()

	genReq := loadRequestToGenerated(req)
	resp, err := c.genLoad.LoadWallpaper(loadCtx, genReq)
	if err != nil {
		return 0, "", err
	}
	body, err := readBody(resp)
	if err != nil {
		return resp.StatusCode, "", err
	}
	return resp.StatusCode, body, nil
}

func (c *controlClient) setAllowNetworkWallpapers(ctx context.Context, allow bool) error {
	req := walqtclient.NetworkSettingsRequest{
		AllowNetworkWallpapers: &allow,
	}
	resp, err := c.gen.SetNetworkSettings(ctx, req)
	if err != nil {
		return err
	}
	body, err := readBody(resp)
	if err != nil {
		return err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return classifyHTTPError(resp.StatusCode, body)
	}
	return nil
}

func (c *controlClient) setImagePresentation(ctx context.Context, fit, rendering, fillColor string) error {
	fitMode := walqtclient.ImagePresentationRequestImageFitMode(fit)
	rendMode := walqtclient.ImagePresentationRequestImageRendering(rendering)
	req := walqtclient.ImagePresentationRequest{
		ImageFitMode:   &fitMode,
		ImageRendering: &rendMode,
	}
	if fillColor != "" {
		req.FillColor = &fillColor
	}
	resp, err := c.gen.SetImagePresentation(ctx, req)
	if err != nil {
		return err
	}
	body, err := readBody(resp)
	if err != nil {
		return err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return classifyHTTPError(resp.StatusCode, body)
	}
	return nil
}

func (c *controlClient) pushWallpaperConfig(ctx context.Context, sourceTarget string, valuesJSON json.RawMessage) error {
	var values map[string]interface{}
	if len(valuesJSON) > 0 {
		if err := json.Unmarshal(valuesJSON, &values); err != nil {
			return fmt.Errorf("decode wallpaper config values: %w", err)
		}
	} else {
		values = map[string]interface{}{}
	}
	req := walqtclient.WallpaperConfigRequest{
		SourceTarget: sourceTarget,
		Values:       &values,
	}
	resp, err := c.gen.PushWallpaperConfig(ctx, req)
	if err != nil {
		return err
	}
	body, err := readBody(resp)
	if err != nil {
		return err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return classifyHTTPError(resp.StatusCode, body)
	}
	return nil
}

func (c *controlClient) pushWebCapabilities(ctx context.Context, sourceTarget string, capsJSON json.RawMessage) error {
	var caps struct {
		AudioReactive      *bool `json:"audio_reactive,omitempty"`
		Keyboard           *bool `json:"keyboard,omitempty"`
		PointerInteractive *bool `json:"pointer_interactive,omitempty"`
	}
	if len(capsJSON) > 0 {
		if err := json.Unmarshal(capsJSON, &caps); err != nil {
			return fmt.Errorf("decode web capabilities: %w", err)
		}
	}
	req := walqtclient.CapabilitiesRequest{
		SourceTarget: sourceTarget,
	}
	if caps.AudioReactive != nil || caps.Keyboard != nil || caps.PointerInteractive != nil {
		req.Capabilities = &struct {
			AudioReactive      *bool `json:"audio_reactive,omitempty"`
			Keyboard           *bool `json:"keyboard,omitempty"`
			PointerInteractive *bool `json:"pointer_interactive,omitempty"`
		}{
			AudioReactive:      caps.AudioReactive,
			Keyboard:           caps.Keyboard,
			PointerInteractive: caps.PointerInteractive,
		}
	}
	resp, err := c.gen.PushCapabilities(ctx, req)
	if err != nil {
		return err
	}
	body, err := readBody(resp)
	if err != nil {
		return err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return classifyHTTPError(resp.StatusCode, body)
	}
	return nil
}

func (c *controlClient) setParallax(ctx context.Context, bodyMap map[string]any) error {
	req := parallaxMapToGenerated(bodyMap)
	resp, err := c.gen.SetParallax(ctx, req)
	if err != nil {
		return err
	}
	body, err := readBody(resp)
	if err != nil {
		return err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return classifyHTTPError(resp.StatusCode, body)
	}
	return nil
}

// parallaxMove posts a relative direction move to POST /wallpaper/parallax-move.
func (c *controlClient) parallaxMove(ctx context.Context, outputName, direction string) error {
	dir := walqtclient.ParallaxMoveRequestDirection(direction)
	req := walqtclient.ParallaxMoveRequest{
		Direction: dir,
	}
	if outputName != "" {
		req.Name = &outputName
	}
	resp, err := c.gen.MoveParallax(ctx, req)
	if err != nil {
		return err
	}
	body, err := readBody(resp)
	if err != nil {
		return err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return classifyHTTPError(resp.StatusCode, body)
	}
	return nil
}

// loadRequestToGenerated converts the internal loadRequest to the generated LoadRequest type.
func loadRequestToGenerated(req loadRequest) walqtclient.LoadRequest {
	out := walqtclient.LoadRequest{}

	if req.Kind != "" {
		k := walqtclient.LoadRequestKind(req.Kind)
		out.Kind = &k
	}
	if req.Target != "" {
		out.Target = &req.Target
	}
	out.AudioEnabled = &req.AudioEnabled
	out.WaitForCompletion = &req.WaitForCompletion
	if req.DurationMS > 0 {
		out.DurationMs = &req.DurationMS
	}

	if len(req.Targets) > 0 {
		targets := make([]walqtclient.WallpaperTarget, 0, len(req.Targets))
		for _, t := range req.Targets {
			wt := walqtclient.WallpaperTarget{
				Name:   t.Name,
				Target: t.Target,
			}
			if t.Kind != "" {
				k := walqtclient.WallpaperTargetKind(t.Kind)
				wt.Kind = &k
			}
			targets = append(targets, wt)
		}
		out.Targets = &targets
	}

	if len(req.WallpaperConfigValues) > 0 {
		var vals map[string]interface{}
		if err := json.Unmarshal(req.WallpaperConfigValues, &vals); err == nil {
			out.WallpaperConfigValues = &vals
		}
	}

	if req.Transition != "" {
		t := walqtclient.LoadRequestTransition(req.Transition)
		out.Transition = &t
	}
	if req.TransitionParams != nil {
		p := req.TransitionParams
		bezier := []float32{p.Bezier[0], p.Bezier[1], p.Bezier[2], p.Bezier[3]}
		angle, ox, oy := p.AngleDeg, p.OriginXPercent, p.OriginYPercent
		wa, wf := p.WaveAmplitudePercent, p.WaveFrequency
		out.TransitionParams = &walqtclient.LoadTransitionParams{
			Bezier:               &bezier,
			AngleDeg:             &angle,
			OriginXPercent:       &ox,
			OriginYPercent:       &oy,
			WaveAmplitudePercent: &wa,
			WaveFrequency:        &wf,
		}
	}
	if req.ImageFitMode != "" {
		out.ImageFitMode = &req.ImageFitMode
	}
	if req.ImageRendering != "" {
		out.ImageRendering = &req.ImageRendering
	}
	if len(req.Parallax) > 0 {
		if bytes, err := json.Marshal(req.Parallax); err == nil {
			var p walqtclient.LoadParallax
			if err := json.Unmarshal(bytes, &p); err == nil {
				out.Parallax = &p
			}
		}
	}

	return out
}

// parallaxMapToGenerated converts the map[string]any parallax body to the generated ParallaxRequest.
// The engine uses buildParallaxRequestBody which produces a map; this adapts it.
// buildParallaxRequestBody emits float32 for zoom/step/easing and uint64 for ms fields.
func parallaxMapToGenerated(m map[string]any) walqtclient.ParallaxRequest {
	req := walqtclient.ParallaxRequest{}
	if v, ok := m["enabled"].(bool); ok {
		req.Enabled = &v
	}
	// zoom: float32 from buildParallaxRequestBody
	switch v := m["zoom"].(type) {
	case float32:
		f := float64(v)
		req.Zoom = &f
	case float64:
		req.Zoom = &v
	}
	// step_percent: float32 from buildParallaxRequestBody
	switch v := m["step_percent"].(type) {
	case float32:
		f := float64(v)
		req.StepPercent = &f
	case float64:
		req.StepPercent = &v
	}
	// animation_ms: uint64 from buildParallaxRequestBody
	switch v := m["animation_ms"].(type) {
	case uint64:
		i := int(v)
		req.AnimationMs = &i
	case int:
		req.AnimationMs = &v
	case float64:
		i := int(v)
		req.AnimationMs = &i
	}
	// reset_ms: uint64 from buildParallaxRequestBody
	switch v := m["reset_ms"].(type) {
	case uint64:
		i := int(v)
		req.ResetMs = &i
	case int:
		req.ResetMs = &v
	case float64:
		i := int(v)
		req.ResetMs = &i
	}
	// easing: []float32 from buildParallaxRequestBody, or []float64, or []any
	switch v := m["easing"].(type) {
	case []float64:
		req.Easing = &v
	case []float32:
		floats := make([]float64, len(v))
		for i, f := range v {
			floats[i] = float64(f)
		}
		req.Easing = &floats
	case []any:
		floats := make([]float64, 0, len(v))
		for _, e := range v {
			switch n := e.(type) {
			case float64:
				floats = append(floats, n)
			case float32:
				floats = append(floats, float64(n))
			}
		}
		if len(floats) > 0 {
			req.Easing = &floats
		}
	}
	if n, ok := m["name"].(string); ok && n != "" {
		req.Name = &n
	}
	return req
}
