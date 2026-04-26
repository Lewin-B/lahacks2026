package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/moby/moby/client"

	picoclawutils "server/picoclaw-utils"
)

type deployRequest struct {
	picoclawutils.Options

	PicoclawURL string `json:"picoclaw_url"`

	Name           *string             `json:"name,omitempty"`
	Mode           *picoclawutils.Mode `json:"mode,omitempty"`
	Image          *string             `json:"image,omitempty"`
	DataDir        *string             `json:"data_dir,omitempty"`
	GatewayHost    *string             `json:"gateway_host,omitempty"`
	GatewayPort    *int                `json:"gateway_port,omitempty"`
	LauncherPort   *int                `json:"launcher_port,omitempty"`
	DashboardToken *string             `json:"dashboard_token,omitempty"`
	Pull           *bool               `json:"pull,omitempty"`
	Replace        *bool               `json:"replace,omitempty"`
	PrintOnly      *bool               `json:"print_only,omitempty"`
}

type deployResponse struct {
	Result    picoclawutils.Result `json:"result,omitempty"`
	PublicURL string               `json:"public_url,omitempty"`
	Token     *string              `json:"token,omitempty"`
	Error     string               `json:"error,omitempty"`
}

var (
	deployPicoclaw = picoclawutils.Deploy
	exposePicoclaw = newNgrokTunnelManager().Expose
)

type agentStatusResponse struct {
	Running bool   `json:"running"`
	Status  string `json:"status"`
	Error   string `json:"error,omitempty"`
}

func listAgentsHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	apiClient, err := client.New(client.FromEnv)
	if err != nil {
		writeErrorJSON(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer apiClient.Close()

	containers, err := apiClient.ContainerList(ctx, client.ContainerListOptions{
		All: true,
	})
	if err != nil {
		writeErrorJSON(w, http.StatusInternalServerError, err.Error())
		return
	}

	// Filter for picoclaw containers
	var picoclawContainers []map[string]interface{}
	for _, container := range containers {
		for _, name := range container.Names {
			if strings.Contains(name, "picoclaw") {
				picoclawContainers = append(picoclawContainers, map[string]interface{}{
					"id":      container.ID,
					"name":    strings.TrimPrefix(name, "/"),
					"image":   container.Image,
					"status":  container.Status,
					"state":   container.State,
					"created": container.Created,
				})
			}
		}
	}

	writeGenericJSON(w, http.StatusOK, map[string]interface{}{
		"agents": picoclawContainers,
	})
}

func agentStatusHandler(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")
	ctx := r.Context()

	apiClient, err := client.New(client.FromEnv)
	if err != nil {
		writeErrorJSON(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer apiClient.Close()

	inspect, err := apiClient.ContainerInspect(ctx, name, client.ContainerInspectOptions{})
	if err != nil {
		writeGenericJSON(w, http.StatusOK, agentStatusResponse{
			Running: false,
			Status:  "not found",
			Error:   err.Error(),
		})
		return
	}

	writeGenericJSON(w, http.StatusOK, agentStatusResponse{
		Running: inspect.State.Running,
		Status:  inspect.State.Status,
	})
}

func deleteAgentHandler(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")
	ctx := r.Context()

	apiClient, err := client.New(client.FromEnv)
	if err != nil {
		writeErrorJSON(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer apiClient.Close()

	_, err = apiClient.ContainerRemove(ctx, name, client.ContainerRemoveOptions{
		Force: true,
	})
	if err != nil {
		writeErrorJSON(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeGenericJSON(w, http.StatusOK, map[string]string{
		"status": "deleted",
		"name":   name,
	})
}

func writeErrorJSON(w http.ResponseWriter, status int, message string) {
	writeGenericJSON(w, status, map[string]string{"error": message})
}

func main() {
	addr := "localhost:3000"
	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Get("/", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("welcome"))
	})
	r.Post("/deploy", deployHandler)
	r.Get("/agents", listAgentsHandler)
	r.Get("/agents/{name}/status", agentStatusHandler)
	r.Delete("/agents/{name}", deleteAgentHandler)
	log.Printf("listening on http://%s", addr)
	err := http.ListenAndServe(addr, r)

	if err != nil {
		panic(err)
	}
}

func deployHandler(w http.ResponseWriter, r *http.Request) {
	defer r.Body.Close()

	var req deployRequest
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, deployResponse{
			Error: "invalid request body: " + err.Error(),
		})
		return
	}

	var extra json.RawMessage
	if err := decoder.Decode(&extra); err != io.EOF {
		writeJSON(w, http.StatusBadRequest, deployResponse{
			Error: "request body must contain a single JSON object",
		})
		return
	}

	result, err := deployPicoclaw(r.Context(), req.options())
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, deployResponse{
			Error: err.Error(),
		})
		return
	}

	upstreamURL, err := picoclawUpstreamURL(req.PicoclawURL, result)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, deployResponse{
			Error: err.Error(),
		})
		return
	}

	publicURL, err := exposePicoclaw(r.Context(), result.ContainerName, upstreamURL)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, deployResponse{
			Error: err.Error(),
		})
		return
	}

	token := result.Options.DashboardToken
	writeJSON(w, http.StatusOK, deployResponse{
		Result:    result,
		PublicURL: publicURL,
		Token:     &token,
	})
}

func (r deployRequest) options() picoclawutils.Options {
	opts := r.Options
	if r.Name != nil {
		opts.Name = *r.Name
	}
	if r.Mode != nil {
		opts.Mode = *r.Mode
	}
	if r.Image != nil {
		opts.Image = *r.Image
	}
	if r.DataDir != nil {
		opts.DataDir = *r.DataDir
	}
	if r.GatewayHost != nil {
		opts.GatewayHost = *r.GatewayHost
	}
	if r.GatewayPort != nil {
		opts.GatewayPort = *r.GatewayPort
	}
	if r.LauncherPort != nil {
		opts.LauncherPort = *r.LauncherPort
	}
	if r.DashboardToken != nil {
		opts.DashboardToken = *r.DashboardToken
	}
	if r.Pull != nil {
		opts.Pull = *r.Pull
	}
	if r.Replace != nil {
		opts.Replace = *r.Replace
	}
	if r.PrintOnly != nil {
		opts.PrintOnly = *r.PrintOnly
	}
	return opts
}

func picoclawUpstreamURL(explicitURL string, result picoclawutils.Result) (string, error) {
	if upstreamURL := strings.TrimSpace(explicitURL); upstreamURL != "" {
		return upstreamURL, nil
	}

	opts := result.Options
	switch opts.Mode {
	case picoclawutils.ModeGateway, "":
		if opts.GatewayPort == 0 {
			return "", errors.New("gateway port is required to infer picoclaw url")
		}
		return fmt.Sprintf("http://localhost:%d", opts.GatewayPort), nil
	case picoclawutils.ModeLauncher:
		if opts.LauncherPort == 0 {
			return "", errors.New("launcher port is required to infer picoclaw url")
		}
		return fmt.Sprintf("http://localhost:%d", opts.LauncherPort), nil
	default:
		return "", fmt.Errorf("invalid mode %q: cannot infer picoclaw url", opts.Mode)
	}
}

type deployFunc func(context.Context, picoclawutils.Options) (picoclawutils.Result, error)
type exposeFunc func(context.Context, string, string) (string, error)

func writeJSON(w http.ResponseWriter, status int, payload deployResponse) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)

	if err := json.NewEncoder(w).Encode(payload); err != nil {
		log.Printf("write json response: %v", err)
	}
}
