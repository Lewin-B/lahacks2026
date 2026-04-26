package picoclawutils

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strings"

	"github.com/moby/moby/api/types/container"
	"github.com/moby/moby/client"
)

const (
	deploymentManagedLabel = "com.drip.managed"
	deploymentKindLabel    = "com.drip.deployment.kind"
	deploymentModeLabel    = "com.drip.deployment.mode"
)

var ErrDeploymentNotFound = errors.New("agent deployment not found")

type Deployment struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	Image        string `json:"image"`
	State        string `json:"state"`
	Status       string `json:"status"`
	Created      int64  `json:"created"`
	Mode         Mode   `json:"mode"`
	GatewayPort  int    `json:"gateway_port,omitempty"`
	LauncherPort int    `json:"launcher_port,omitempty"`
	GatewayURL   string `json:"gateway_url,omitempty"`
	LauncherURL  string `json:"launcher_url,omitempty"`
	PublicURL    string `json:"public_url,omitempty"`
}

type dockerDeploymentListClient interface {
	ContainerList(context.Context, client.ContainerListOptions) (client.ContainerListResult, error)
}

type dockerDeploymentDeleteClient interface {
	dockerDeploymentListClient
	ContainerRemove(context.Context, string, client.ContainerRemoveOptions) (client.ContainerRemoveResult, error)
}

func ListDeployments(ctx context.Context) ([]Deployment, error) {
	apiClient, err := client.New(client.FromEnv)
	if err != nil {
		return nil, fmt.Errorf("create docker client: %w", err)
	}
	defer apiClient.Close()

	return listDeploymentsWithClient(ctx, apiClient)
}

func DeleteDeployment(ctx context.Context, identifier string) (Deployment, error) {
	identifier = strings.TrimSpace(identifier)
	if identifier == "" {
		return Deployment{}, fmt.Errorf("deployment identifier is required")
	}

	apiClient, err := client.New(client.FromEnv)
	if err != nil {
		return Deployment{}, fmt.Errorf("create docker client: %w", err)
	}
	defer apiClient.Close()

	return deleteDeploymentWithClient(ctx, apiClient, identifier)
}

func listDeploymentsWithClient(ctx context.Context, apiClient dockerDeploymentListClient) ([]Deployment, error) {
	result, err := apiClient.ContainerList(ctx, client.ContainerListOptions{All: true})
	if err != nil {
		return nil, fmt.Errorf("list containers: %w", err)
	}

	deployments := make([]Deployment, 0, len(result.Items))
	for _, item := range result.Items {
		if !isPicoclawDeployment(item) {
			continue
		}
		deployments = append(deployments, deploymentFromContainer(item))
	}

	sort.SliceStable(deployments, func(i, j int) bool {
		return deployments[i].Created > deployments[j].Created
	})

	return deployments, nil
}

func deleteDeploymentWithClient(ctx context.Context, apiClient dockerDeploymentDeleteClient, identifier string) (Deployment, error) {
	deployments, err := listDeploymentsWithClient(ctx, apiClient)
	if err != nil {
		return Deployment{}, err
	}

	deployment, ok := findDeployment(deployments, identifier)
	if !ok {
		return Deployment{}, fmt.Errorf("%w: %q", ErrDeploymentNotFound, identifier)
	}

	if _, err := apiClient.ContainerRemove(ctx, deployment.ID, client.ContainerRemoveOptions{Force: true}); err != nil {
		return Deployment{}, fmt.Errorf("delete deployment %q: %w", deployment.Name, err)
	}

	return deployment, nil
}

func deploymentLabels(mode Mode) map[string]string {
	return map[string]string{
		deploymentManagedLabel: "true",
		deploymentKindLabel:    deploymentKind(mode),
		deploymentModeLabel:    string(mode),
	}
}

func deploymentKind(mode Mode) string {
	if mode == ModeLauncher {
		return "agent"
	}
	return "gateway"
}

func isPicoclawDeployment(summary container.Summary) bool {
	if kind := summary.Labels[deploymentKindLabel]; kind != "" {
		return kind == "agent"
	}

	if summary.Labels[deploymentManagedLabel] == "true" &&
		Mode(summary.Labels[deploymentModeLabel]) == ModeLauncher {
		return true
	}

	image := strings.ToLower(summary.Image)
	if strings.Contains(image, "sipeed/picoclaw:launcher") {
		return true
	}
	if strings.Contains(image, "sipeed/picoclaw") &&
		hostPortForPrivatePort(summary.Ports, 18800) > 0 {
		return true
	}

	for _, name := range summary.Names {
		normalized := strings.TrimPrefix(strings.ToLower(name), "/")
		if strings.HasPrefix(normalized, "drip-agent") ||
			strings.HasPrefix(normalized, "picoclaw-launcher") {
			return true
		}
	}

	return false
}

func deploymentFromContainer(summary container.Summary) Deployment {
	gatewayPort := hostPortForPrivatePort(summary.Ports, 18790)
	launcherPort := hostPortForPrivatePort(summary.Ports, 18800)
	mode := deploymentMode(summary, launcherPort)

	deployment := Deployment{
		ID:           summary.ID,
		Name:         containerName(summary),
		Image:        summary.Image,
		State:        string(summary.State),
		Status:       summary.Status,
		Created:      summary.Created,
		Mode:         mode,
		GatewayPort:  gatewayPort,
		LauncherPort: launcherPort,
	}

	if gatewayPort > 0 {
		deployment.GatewayURL = fmt.Sprintf("http://localhost:%d", gatewayPort)
	}
	if launcherPort > 0 {
		deployment.LauncherURL = fmt.Sprintf("http://localhost:%d", launcherPort)
	}

	return deployment
}

func deploymentMode(summary container.Summary, launcherPort int) Mode {
	switch Mode(summary.Labels[deploymentModeLabel]) {
	case ModeGateway:
		return ModeGateway
	case ModeLauncher:
		return ModeLauncher
	}

	image := strings.ToLower(summary.Image)
	if launcherPort > 0 || strings.Contains(image, ":launcher") {
		return ModeLauncher
	}

	for _, name := range summary.Names {
		normalized := strings.TrimPrefix(strings.ToLower(name), "/")
		if strings.Contains(normalized, "agent") ||
			strings.Contains(normalized, "launcher") {
			return ModeLauncher
		}
	}

	return ModeGateway
}

func hostPortForPrivatePort(ports []container.PortSummary, privatePort uint16) int {
	for _, port := range ports {
		if port.PrivatePort == privatePort && port.Type == "tcp" && port.PublicPort > 0 {
			return int(port.PublicPort)
		}
	}
	return 0
}

func containerName(summary container.Summary) string {
	for _, name := range summary.Names {
		normalized := strings.TrimPrefix(name, "/")
		if normalized != "" {
			return normalized
		}
	}

	if len(summary.ID) > 12 {
		return summary.ID[:12]
	}
	return summary.ID
}

func findDeployment(deployments []Deployment, identifier string) (Deployment, bool) {
	normalized := strings.TrimPrefix(strings.ToLower(strings.TrimSpace(identifier)), "/")
	for _, deployment := range deployments {
		id := strings.ToLower(deployment.ID)
		name := strings.ToLower(strings.TrimPrefix(deployment.Name, "/"))

		if normalized == name || normalized == id {
			return deployment, true
		}
		if len(id) >= 12 && normalized == id[:12] {
			return deployment, true
		}
	}
	return Deployment{}, false
}
