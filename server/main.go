package main

import (
	"encoding/json"
	"io"
	"log"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"server/utils"
)

type deployResponse struct {
	Result utils.Result `json:"result,omitempty"`
	Error  string       `json:"error,omitempty"`
}

func main() {
	addr := "localhost:3000"
	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Get("/", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("welcome"))
	})
	r.Post("/deploy", deployHandler)
	log.Printf("listening on http://%s", addr)
	err := http.ListenAndServe(addr, r)

	if err != nil {
		panic(err)
	}
}

func deployHandler(w http.ResponseWriter, r *http.Request) {
	defer r.Body.Close()

	var opts utils.Options
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&opts); err != nil {
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

	result, err := utils.Deploy(r.Context(), opts)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, deployResponse{
			Error: err.Error(),
		})
		return
	}

	writeJSON(w, http.StatusOK, deployResponse{
		Result: result,
	})
}

func writeJSON(w http.ResponseWriter, status int, payload deployResponse) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)

	if err := json.NewEncoder(w).Encode(payload); err != nil {
		log.Printf("write json response: %v", err)
	}
}
