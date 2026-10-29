package main

import (
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

func TestCappedBufferKeepsPrefixAndSignalsOnce(t *testing.T) {
	var fired atomic.Int32
	c := &cappedBuffer{limit: 5, onFull: func() { fired.Add(1) }}
	for _, chunk := range []string{"abc", "defg", "hij"} {
		n, err := c.Write([]byte(chunk))
		if err != nil || n != len(chunk) {
			t.Fatalf("Write(%q) = %d, %v; want full length so the copier keeps draining", chunk, n, err)
		}
	}
	if got := c.String(); got != "abcde" {
		t.Fatalf("kept %q, want %q", got, "abcde")
	}
	if !c.overflow {
		t.Fatal("overflow not recorded")
	}
	time.Sleep(10 * time.Millisecond) // onFull runs on its own goroutine
	if n := fired.Load(); n != 1 {
		t.Fatalf("onFull fired %d times, want 1", n)
	}
}

func TestJobValidate(t *testing.T) {
	ok := Job{ID: "abc-1", Lang: "python", Source: "print(1)", Inputs: []string{""}, TimeMs: 1000, MemoryMb: 256}
	if err := ok.validate(); err != nil {
		t.Fatalf("valid job rejected: %v", err)
	}
	if ok.OutputLimit != 64<<10 {
		t.Fatalf("default output limit = %d", ok.OutputLimit)
	}

	cases := map[string]func(j *Job){
		"path traversal id": func(j *Job) { j.ID = "../etc" },
		"unknown language":  func(j *Job) { j.Lang = "brainfuck" },
		"empty source":      func(j *Job) { j.Source = "" },
		"huge source":       func(j *Job) { j.Source = strings.Repeat("x", 513<<10) },
		"no inputs":         func(j *Job) { j.Inputs = nil },
		"time too low":      func(j *Job) { j.TimeMs = 10 },
		"time too high":     func(j *Job) { j.TimeMs = 60000 },
		"memory too high":   func(j *Job) { j.MemoryMb = 8192 },
		"output too big":    func(j *Job) { j.OutputLimit = 17 << 20 },
	}
	for name, mutate := range cases {
		j := ok
		j.OutputLimit = 0
		mutate(&j)
		if err := j.validate(); err == nil {
			t.Errorf("%s: accepted", name)
		}
	}
}
