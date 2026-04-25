package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"os"
	"strings"
	"sync"

	"golang.ngrok.com/ngrok/v2"
)

type ngrokTunnelManager struct {
	mu      sync.Mutex
	tunnels map[string]managedNgrokTunnel
}

type managedNgrokTunnel struct {
	agent    ngrok.Agent
	endpoint ngrok.EndpointForwarder
}

const (
	ngrokURLEnv    = "NGROK_URL"
	ngrokDomainEnv = "NGROK_DOMAIN"
)

func newNgrokTunnelManager() *ngrokTunnelManager {
	return &ngrokTunnelManager{
		tunnels: make(map[string]managedNgrokTunnel),
	}
}

func (m *ngrokTunnelManager) Expose(ctx context.Context, key, upstreamURL string) (string, error) {
	key = strings.TrimSpace(key)
	if key == "" {
		return "", errors.New("container name is required to create ngrok tunnel")
	}

	upstreamURL = strings.TrimSpace(upstreamURL)
	if upstreamURL == "" {
		return "", errors.New("picoclaw url is required to create ngrok tunnel")
	}

	authtoken := strings.TrimSpace(os.Getenv("NGROK_AUTHTOKEN"))
	if authtoken == "" {
		return "", errors.New("NGROK_AUTHTOKEN must be set to create ngrok tunnel")
	}

	m.closeExisting(key)

	agent, err := ngrok.NewAgent(ngrok.WithAuthtoken(authtoken))
	if err != nil {
		return "", fmt.Errorf("create ngrok agent: %w", err)
	}

	endpoint, err := agent.Forward(ngrokTunnelContext(ctx), ngrok.WithUpstream(upstreamURL), ngrokEndpointOptions()...)
	if err != nil {
		_ = agent.Disconnect()
		return "", fmt.Errorf("create ngrok tunnel for %q: %w", upstreamURL, err)
	}

	publicURL := endpoint.URL()
	if publicURL == nil {
		closeNgrokTunnel(managedNgrokTunnel{agent: agent, endpoint: endpoint})
		return "", errors.New("ngrok tunnel did not return a public url")
	}

	m.mu.Lock()
	m.tunnels[key] = managedNgrokTunnel{
		agent:    agent,
		endpoint: endpoint,
	}
	m.mu.Unlock()

	return publicURL.String(), nil
}

func (m *ngrokTunnelManager) closeExisting(key string) {
	m.mu.Lock()
	existing, ok := m.tunnels[key]
	if ok {
		delete(m.tunnels, key)
	}
	m.mu.Unlock()

	if ok {
		closeNgrokTunnel(existing)
	}
}

func closeNgrokTunnel(tunnel managedNgrokTunnel) {
	if tunnel.endpoint != nil {
		if err := tunnel.endpoint.Close(); err != nil {
			log.Printf("close ngrok endpoint: %v", err)
		}
	}
	if tunnel.agent != nil {
		if err := tunnel.agent.Disconnect(); err != nil {
			log.Printf("disconnect ngrok agent: %v", err)
		}
	}
}

func ngrokEndpointOptions() []ngrok.EndpointOption {
	endpointURL := ngrokEndpointURL()
	if endpointURL == "" {
		return nil
	}
	return []ngrok.EndpointOption{ngrok.WithURL(endpointURL)}
}

func ngrokTunnelContext(ctx context.Context) context.Context {
	if ctx == nil {
		return context.Background()
	}
	return context.WithoutCancel(ctx)
}

func ngrokEndpointURL() string {
	if endpointURL := strings.TrimSpace(os.Getenv(ngrokURLEnv)); endpointURL != "" {
		return endpointURL
	}

	domain := strings.TrimSpace(os.Getenv(ngrokDomainEnv))
	if domain == "" {
		return ""
	}
	if strings.Contains(domain, "://") {
		return domain
	}
	return "https://" + domain
}
