// kc-run is the trusted supervisor inside a judge box. It receives one job at a time over HTTP,
// runs every compile and test step through kc-exec (limits, seccomp, unprivileged uid), measures
// CPU time and peak memory from the kernel, caps output, and cleans the box between jobs.
//
// It never sees expected outputs: it returns raw outputs and the judge Worker decides the verdict.
package main

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"os"
	"sync"
	"time"
)

const (
	listenAddr = ":8080"
	maxBody    = 2 << 20 // source + test inputs per request
)

func main() {
	cfg := loadConfig()
	r := &runner{cfg: cfg}
	if err := r.prepare(); err != nil {
		log.Fatalf("prepare: %v", err)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{"ok": true, "busy": r.busy()})
	})
	mux.HandleFunc("GET /introspect", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, introspect(cfg))
	})
	mux.HandleFunc("POST /run", func(w http.ResponseWriter, req *http.Request) {
		var job Job
		dec := json.NewDecoder(http.MaxBytesReader(w, req.Body, maxBody))
		dec.DisallowUnknownFields()
		if err := dec.Decode(&job); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		if err := job.validate(); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		res, err := r.run(&job)
		if errors.Is(err, errBusy) {
			writeJSON(w, http.StatusConflict, map[string]string{"error": "box is busy"})
			return
		}
		if err != nil {
			log.Printf("job %s: internal error: %v", job.ID, err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, res)
	})

	srv := &http.Server{Addr: listenAddr, Handler: mux, ReadHeaderTimeout: 5 * time.Second}
	log.Printf("kc-run listening on %s (sandbox uid %d)", listenAddr, cfg.UID)
	log.Fatal(srv.ListenAndServe())
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

type config struct {
	UID, GID int
	WorkRoot string
	KcExec   string
}

func loadConfig() config {
	c := config{UID: 2000, GID: 2000, WorkRoot: "/work", KcExec: "/opt/kc/kc-exec"}
	if v := os.Getenv("KC_EXEC"); v != "" {
		c.KcExec = v
	}
	if v := os.Getenv("KC_WORK_ROOT"); v != "" {
		c.WorkRoot = v
	}
	return c
}

type runner struct {
	cfg config
	mu  sync.Mutex
	on  bool
}

var errBusy = errors.New("busy")

func (r *runner) busy() bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.on
}

func (r *runner) acquire() bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.on {
		return false
	}
	r.on = true
	return true
}

func (r *runner) release() {
	r.mu.Lock()
	r.on = false
	r.mu.Unlock()
}

func (r *runner) prepare() error {
	if err := os.MkdirAll(r.cfg.WorkRoot, 0o711); err != nil {
		return err
	}
	return os.Chmod(r.cfg.WorkRoot, 0o711)
}
