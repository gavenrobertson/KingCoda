package main

import (
	"errors"
	"fmt"
	"regexp"
)

// Job is one compile + run request. Inputs are raw stdin strings; expected outputs never come here.
type Job struct {
	ID   string `json:"id"`
	Lang string `json:"lang"`
	// Source is a single-file program, written as the language's default file name.
	Source string `json:"source,omitempty"`
	// Files is a multi-file program (user code plus the harness driver). Takes precedence over Source.
	Files       map[string]string `json:"files,omitempty"`
	Inputs      []string          `json:"inputs"`
	TimeMs      int               `json:"timeMs"`
	MemoryMb    int               `json:"memoryMb"`
	OutputLimit int               `json:"outputLimit"`
	// StopOnFailure stops after the first test that doesn't exit cleanly (Submit mode).
	StopOnFailure bool `json:"stopOnFailure"`
}

// Status is the sandbox's view of a step. The Worker turns these into verdicts.
type Status string

const (
	StatusOK          Status = "ok"           // exited 0 within limits
	StatusTLE         Status = "tle"          // CPU or wall limit
	StatusMLE         Status = "mle"          // peak memory over the limit
	StatusOLE         Status = "ole"          // stdout over the output limit
	StatusRE          Status = "re"           // non-zero exit or fatal signal
	StatusCE          Status = "ce"           // compile step failed
	StatusSandboxFail Status = "sandbox_fail" // kc-exec could not set up the sandbox (our fault)
)

type StepResult struct {
	Status   Status `json:"status"`
	Stdout   string `json:"stdout"`
	Stderr   string `json:"stderr"`
	ExitCode int    `json:"exitCode"`
	Signal   string `json:"signal,omitempty"`
	CPUMs    int64  `json:"cpuMs"`
	WallMs   int64  `json:"wallMs"`
	MaxRSSKb int64  `json:"maxRssKb"`
}

type Result struct {
	ID      string       `json:"id"`
	Compile *StepResult  `json:"compile,omitempty"`
	Tests   []StepResult `json:"tests"`
	// Strays counts uid-sandbox processes that outlived their step and were killed during cleanup.
	Strays int `json:"strays"`
}

var (
	idPattern   = regexp.MustCompile(`^[A-Za-z0-9_-]{1,64}$`)
	filePattern = regexp.MustCompile(`^[A-Za-z0-9_][A-Za-z0-9_.-]{0,63}$`)
)

const (
	maxSourceBytes = 512 << 10
	maxInputBytes  = 24 << 20
	maxOutputLimit = 16 << 20
)

func (j *Job) validate() error {
	if !idPattern.MatchString(j.ID) {
		return errors.New("id must be 1-64 chars of [A-Za-z0-9_-]")
	}
	if _, ok := languages[j.Lang]; !ok {
		return fmt.Errorf("unsupported lang %q", j.Lang)
	}
	if len(j.Files) > 0 {
		total := 0
		for name, content := range j.Files {
			if !filePattern.MatchString(name) || name == "." || name == ".." {
				return fmt.Errorf("bad file name %q", name)
			}
			total += len(content)
		}
		if len(j.Files) > 8 || total > maxSourceBytes {
			return errors.New("files: at most 8 files and 512 KiB")
		}
		if _, ok := j.Files[languages[j.Lang].file]; !ok {
			return fmt.Errorf("files must include %s", languages[j.Lang].file)
		}
	} else if len(j.Source) == 0 || len(j.Source) > maxSourceBytes {
		return errors.New("source must be 1 byte to 512 KiB")
	}
	if len(j.Inputs) == 0 || len(j.Inputs) > 500 {
		return errors.New("inputs must have 1-500 entries")
	}
	inputBytes := 0
	for _, in := range j.Inputs {
		inputBytes += len(in)
	}
	if inputBytes > maxInputBytes {
		return errors.New("inputs: at most 24 MiB in total")
	}
	if j.TimeMs < 50 || j.TimeMs > 20000 {
		return errors.New("timeMs must be 50-20000")
	}
	if j.MemoryMb < 16 || j.MemoryMb > 2048 {
		return errors.New("memoryMb must be 16-2048")
	}
	if j.OutputLimit == 0 {
		j.OutputLimit = 64 << 10
	}
	if j.OutputLimit < 1 || j.OutputLimit > maxOutputLimit {
		return errors.New("outputLimit must be 1 byte to 16 MiB")
	}
	return nil
}
