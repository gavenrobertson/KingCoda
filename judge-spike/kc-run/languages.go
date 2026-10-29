package main

type language struct {
	file string
	// compile is nil for interpreted languages.
	compile func(memoryMb int) []string
	run     func(memoryMb int) []string
	// nproc counts threads too: Node and the JVM start several.
	nproc int
	// compileTimeMs bounds the compile step's CPU time.
	compileTimeMs int
}

var languages = map[string]language{
	"python": {
		file:  "main.py",
		run:   func(int) []string { return []string{"/usr/bin/python3", "-S", "-B", "main.py"} },
		nproc: 16,
	},
	"javascript": {
		file: "main.js",
		run: func(mb int) []string {
			return []string{"/usr/bin/node", "--max-old-space-size=" + itoa(mb), "--disallow-code-generation-from-strings", "main.js"}
		},
		nproc: 64,
	},
	"cpp": {
		file: "main.cpp",
		compile: func(int) []string {
			return []string{"/usr/bin/g++", "-O2", "-std=c++20", "-pipe", "-o", "main", "main.cpp"}
		},
		run:           func(int) []string { return []string{"./main"} },
		nproc:         16,
		compileTimeMs: 15000,
	},
}
