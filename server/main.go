package main

import (
	"log"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

func main() {
	addr := "localhost:3000"
	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Get("/", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("welcome"))
	})
	log.Printf("listening on http://%s", addr)
	err := http.ListenAndServe(addr, r)

	if err != nil {
		panic(err)
	}
}
