package picoclawutils

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path"
	"path/filepath"
	"strconv"
	"strings"

	cerrdefs "github.com/containerd/errdefs"
	"github.com/moby/moby/api/types/container"
	"github.com/moby/moby/api/types/network"
	"github.com/moby/moby/client"
)

type Mode string

const (
	ModeGateway  Mode = "gateway"
	ModeLauncher Mode = "launcher"
)

const (
	defaultDataDir      = "./picoclaw-data"
	defaultGatewayHost  = "0.0.0.0"
	defaultGatewayPort  = 18790
	defaultLauncherPort = 18800
	containerDataDir    = "/root/.picoclaw"
	configFileName      = "config.json"
	workspaceDirName    = "workspace"
	gatewayPortSpec     = "18790/tcp"
	launcherPortSpec    = "18800/tcp"
	gatewayImage        = "docker.io/sipeed/picoclaw:latest"
	launcherImage       = "docker.io/sipeed/picoclaw:launcher"
)

type Options struct {
	Name           string
	Mode           Mode
	Image          string
	DataDir        string
	GatewayHost    string
	GatewayPort    int
	LauncherPort   int
	DashboardToken string
	Pull           bool
	Replace        bool
	PrintOnly      bool
}

type Result struct {
	Options       Options
	ContainerName string
	Image         string
	DataDir       string
	ConfigPath    string
	CreatedConfig bool
	DockerArgs    []string
}

type dockerClient interface {
	Close() error
	ImagePull(context.Context, string, client.ImagePullOptions) (client.ImagePullResponse, error)
	ContainerInspect(context.Context, string, client.ContainerInspectOptions) (client.ContainerInspectResult, error)
	ContainerRemove(context.Context, string, client.ContainerRemoveOptions) (client.ContainerRemoveResult, error)
	ContainerCreate(context.Context, client.ContainerCreateOptions) (client.ContainerCreateResult, error)
	ContainerStart(context.Context, string, client.ContainerStartOptions) (client.ContainerStartResult, error)
}

func Deploy(ctx context.Context, input Options) (Result, error) {
	apiClient, err := client.New(client.FromEnv)
	if err != nil {
		return Result{}, fmt.Errorf("create docker client: %w", err)
	}
	defer apiClient.Close()

	return deployWithClient(ctx, apiClient, input)
}

func deployWithClient(ctx context.Context, apiClient dockerClient, input Options) (Result, error) {
	opts, err := applyDefaults(input)
	if err != nil {
		return Result{}, err
	}

	absDataDir, err := resolveDataDir(opts.DataDir)
	if err != nil {
		return Result{}, fmt.Errorf("resolve data dir %q: %w", opts.DataDir, err)
	}

	result := Result{
		Options:       opts,
		ContainerName: opts.Name,
		Image:         opts.Image,
		DataDir:       absDataDir,
		ConfigPath:    filepath.Join(absDataDir, configFileName),
		DockerArgs:    BuildDockerArgs(opts, absDataDir),
	}

	if opts.PrintOnly {
		return result, nil
	}

	absDataDir, configPath, createdConfig, err := ensureDataDir(opts)
	if err != nil {
		return Result{}, err
	}
	result.DataDir = absDataDir
	result.ConfigPath = configPath
	result.CreatedConfig = createdConfig

	if opts.Pull {
		pullResponse, err := apiClient.ImagePull(ctx, opts.Image, client.ImagePullOptions{})
		if err != nil {
			return Result{}, fmt.Errorf("pull image %q: %w", opts.Image, err)
		}
		if err := pullResponse.Wait(ctx); err != nil {
			return Result{}, fmt.Errorf("pull image %q: %w", opts.Image, err)
		}
	}

	exists, err := containerExists(ctx, apiClient, opts.Name)
	if err != nil {
		return Result{}, fmt.Errorf("inspect container %q: %w", opts.Name, err)
	}
	if exists {
		if !opts.Replace {
			return Result{}, fmt.Errorf("container %q already exists; rerun with --replace to recreate it", opts.Name)
		}
		if _, err := apiClient.ContainerRemove(ctx, opts.Name, client.ContainerRemoveOptions{Force: true}); err != nil {
			return Result{}, fmt.Errorf("remove container %q: %w", opts.Name, err)
		}
	}

	createOptions, err := buildContainerCreateOptions(opts, absDataDir)
	if err != nil {
		return Result{}, err
	}

	createResult, err := apiClient.ContainerCreate(ctx, createOptions)
	if err != nil {
		return Result{}, fmt.Errorf("create container %q: %w", opts.Name, err)
	}
	if _, err := apiClient.ContainerStart(ctx, createResult.ID, client.ContainerStartOptions{}); err != nil {
		return Result{}, fmt.Errorf("start container %q: %w", opts.Name, err)
	}

	return result, nil
}

func BuildDockerArgs(opts Options, absDataDir string) []string {
	if normalized, err := applyDefaults(opts); err == nil {
		opts = normalized
	}

	args := []string{
		"run",
		"-d",
		"--name", opts.Name,
		"--restart", "unless-stopped",
		"-v", fmt.Sprintf("%s:%s", absDataDir, containerDataDir),
		"-e", "PICOCLAW_GATEWAY_HOST=" + opts.GatewayHost,
		"-p", fmt.Sprintf("%d:18790", opts.GatewayPort),
	}

	if opts.Mode == ModeLauncher {
		args = append(args, "-p", fmt.Sprintf("%d:18800", opts.LauncherPort))
		if opts.DashboardToken != "" {
			args = append(args, "-e", "PICOCLAW_LAUNCHER_TOKEN="+opts.DashboardToken)
		}
	}

	args = append(args, opts.Image)
	return args
}

func applyDefaults(input Options) (Options, error) {
	opts := input
	opts.Name = strings.TrimSpace(opts.Name)
	opts.Image = strings.TrimSpace(opts.Image)
	opts.DataDir = strings.TrimSpace(opts.DataDir)
	opts.GatewayHost = strings.TrimSpace(opts.GatewayHost)
	opts.DashboardToken = strings.TrimSpace(opts.DashboardToken)

	if opts.Mode == "" {
		opts.Mode = ModeGateway
	}

	switch opts.Mode {
	case ModeGateway:
		if opts.Name == "" {
			opts.Name = "picoclaw-gateway"
		}
		if opts.Image == "" {
			opts.Image = gatewayImage
		}
	case ModeLauncher:
		if opts.Name == "" {
			opts.Name = "picoclaw-launcher"
		}
		if opts.Image == "" {
			opts.Image = launcherImage
		}
	default:
		return Options{}, fmt.Errorf("invalid mode %q: expected gateway or launcher", input.Mode)
	}

	if opts.DataDir == "" {
		opts.DataDir = defaultDataDir
	}
	if opts.GatewayHost == "" {
		opts.GatewayHost = defaultGatewayHost
	}

	var err error
	opts.GatewayPort, err = normalizePort("gateway-port", opts.GatewayPort, defaultGatewayPort, true)
	if err != nil {
		return Options{}, err
	}
	opts.LauncherPort, err = normalizePort("launcher-port", opts.LauncherPort, defaultLauncherPort, opts.Mode == ModeLauncher)
	if err != nil {
		return Options{}, err
	}

	return opts, nil
}

func normalizePort(flagName string, current, fallback int, applyFallback bool) (int, error) {
	if current == 0 {
		if applyFallback {
			return fallback, nil
		}
		return 0, nil
	}
	if current < 1 || current > 65535 {
		return 0, fmt.Errorf("%s must be between 1 and 65535", flagName)
	}
	return current, nil
}

func resolveDataDir(dataDir string) (string, error) {
	return filepath.Abs(dataDir)
}

func ensureDataDir(opts Options) (string, string, bool, error) {
	absDataDir, err := resolveDataDir(opts.DataDir)
	if err != nil {
		return "", "", false, fmt.Errorf("resolve data dir %q: %w", opts.DataDir, err)
	}
	if err := os.MkdirAll(absDataDir, 0o755); err != nil {
		return "", "", false, fmt.Errorf("create data dir %q: %w", absDataDir, err)
	}
	if err := os.MkdirAll(filepath.Join(absDataDir, workspaceDirName), 0o755); err != nil {
		return "", "", false, fmt.Errorf("create workspace dir in %q: %w", absDataDir, err)
	}

	configPath := filepath.Join(absDataDir, configFileName)
	if _, err := os.Stat(configPath); err == nil {
		rewritten, err := rewriteLegacyStarterConfig(configPath, opts.GatewayHost)
		if err != nil {
			return "", "", false, err
		}
		return absDataDir, configPath, rewritten, nil
	} else if !os.IsNotExist(err) {
		return "", "", false, fmt.Errorf("stat config %q: %w", configPath, err)
	}

	if err := os.WriteFile(configPath, defaultConfigJSON(opts.GatewayHost), 0o644); err != nil {
		return "", "", false, fmt.Errorf("write starter config %q: %w", configPath, err)
	}

	return absDataDir, configPath, true, nil
}

func rewriteLegacyStarterConfig(configPath, gatewayHost string) (bool, error) {
	content, err := os.ReadFile(configPath)
	if err != nil {
		return false, fmt.Errorf("read config %q: %w", configPath, err)
	}

	needsRewrite, err := legacyStarterConfigNeedsRewrite(content)
	if err != nil {
		return false, fmt.Errorf("inspect config %q: %w", configPath, err)
	}
	if !needsRewrite {
		return false, nil
	}

	if err := os.WriteFile(configPath, defaultConfigJSON(gatewayHost), 0o644); err != nil {
		return false, fmt.Errorf("rewrite starter config %q: %w", configPath, err)
	}
	return true, nil
}

func legacyStarterConfigNeedsRewrite(content []byte) (bool, error) {
	var parsed map[string]any
	if err := json.Unmarshal(content, &parsed); err != nil {
		return false, err
	}

	modelList, hasModelList := parsed["model_list"]
	if hasModelList {
		if _, ok := modelList.([]any); ok {
			return false, nil
		}
		return false, errors.New("config.json has invalid model_list shape")
	}

	providers, hasProviders := parsed["providers"]
	if !hasProviders {
		return false, nil
	}

	_, providersIsArray := providers.([]any)
	return providersIsArray, nil
}

func defaultConfigJSON(gatewayHost string) []byte {
	type agentDefaultsConfig struct {
		Workspace           string `json:"workspace"`
		RestrictToWorkspace bool   `json:"restrict_to_workspace"`
		ModelName           string `json:"model_name"`
		MaxTokens           int    `json:"max_tokens"`
		MaxToolIterations   int    `json:"max_tool_iterations"`
	}
	type agentsConfig struct {
		Defaults agentDefaultsConfig `json:"defaults"`
	}
	type gatewayConfig struct {
		Host string `json:"host"`
		Port int    `json:"port"`
	}
	type modelConfig struct {
		ModelName string   `json:"model_name"`
		Model     string   `json:"model"`
		APIKeys   []string `json:"api_keys"`
	}
	type workspaceConfig struct {
		Root string `json:"root"`
	}
	payload := struct {
		Version   int             `json:"version"`
		Agents    agentsConfig    `json:"agents"`
		Gateway   gatewayConfig   `json:"gateway"`
		ModelList []modelConfig   `json:"model_list"`
		Workspace workspaceConfig `json:"workspace"`
	}{
		Version: 2,
		Agents: agentsConfig{
			Defaults: agentDefaultsConfig{
				Workspace:           path.Join(containerDataDir, workspaceDirName),
				RestrictToWorkspace: true,
				ModelName:           "gpt-5.4",
				MaxTokens:           32768,
				MaxToolIterations:   50,
			},
		},
		Gateway: gatewayConfig{
			Host: gatewayHost,
			Port: defaultGatewayPort,
		},
		ModelList: []modelConfig{
			{
				ModelName: "gpt-5.4",
				Model:     "openai/gpt-5.4",
				APIKeys:   []string{"sk-your-openai-key"},
			},
		},
		Workspace: workspaceConfig{
			Root: path.Join(containerDataDir, workspaceDirName),
		},
	}

	content, err := json.MarshalIndent(payload, "", "  ")
	if err != nil {
		return []byte("{\"gateway\":{\"host\":\"0.0.0.0\",\"port\":18790}}\n")
	}
	return append(content, '\n')
}

func containerExists(ctx context.Context, apiClient dockerClient, name string) (bool, error) {
	_, err := apiClient.ContainerInspect(ctx, name, client.ContainerInspectOptions{})
	if err == nil {
		return true, nil
	}
	if cerrdefs.IsNotFound(err) {
		return false, nil
	}
	return false, err
}

func buildContainerCreateOptions(opts Options, absDataDir string) (client.ContainerCreateOptions, error) {
	portBindings := network.PortMap{}
	exposedPorts := network.PortSet{}

	gatewayPort, err := network.ParsePort(gatewayPortSpec)
	if err != nil {
		return client.ContainerCreateOptions{}, fmt.Errorf("parse gateway port spec: %w", err)
	}
	exposedPorts[gatewayPort] = struct{}{}
	portBindings[gatewayPort] = []network.PortBinding{{
		HostPort: strconv.Itoa(opts.GatewayPort),
	}}

	if opts.Mode == ModeLauncher {
		launcherPort, err := network.ParsePort(launcherPortSpec)
		if err != nil {
			return client.ContainerCreateOptions{}, fmt.Errorf("parse launcher port spec: %w", err)
		}
		exposedPorts[launcherPort] = struct{}{}
		portBindings[launcherPort] = []network.PortBinding{{
			HostPort: strconv.Itoa(opts.LauncherPort),
		}}
	}

	env := []string{"PICOCLAW_GATEWAY_HOST=" + opts.GatewayHost}
	if opts.Mode == ModeLauncher && opts.DashboardToken != "" {
		env = append(env, "PICOCLAW_LAUNCHER_TOKEN="+opts.DashboardToken)
	}

	return client.ContainerCreateOptions{
		Name:  opts.Name,
		Image: opts.Image,
		Config: &container.Config{
			Env:          env,
			ExposedPorts: exposedPorts,
		},
		HostConfig: &container.HostConfig{
			Binds:        []string{fmt.Sprintf("%s:%s", absDataDir, containerDataDir)},
			PortBindings: portBindings,
			RestartPolicy: container.RestartPolicy{
				Name: container.RestartPolicyUnlessStopped,
			},
		},
	}, nil
}
