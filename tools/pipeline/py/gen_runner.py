"""Runs a problem's gen.py / brute.py for the pipeline. Content is trusted repo code, not user code.

  gen_runner.py edges   <pkg_dir>                       -> JSON list of {"category", "args"}
  gen_runner.py random  <pkg_dir> <size> <seed> <count> -> JSON list of args dicts
  gen_runner.py brute   <pkg_dir>                       -> reads JSON list of args dicts on stdin, writes outputs
"""
import importlib.util
import json
import random
import sys


def load(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def main():
    cmd, pkg = sys.argv[1], sys.argv[2]
    sys.setrecursionlimit(100000)
    if cmd == "edges":
        out = load(f"{pkg}/gen.py", "gen").edge_cases()
    elif cmd == "random":
        size, seed, count = sys.argv[3], int(sys.argv[4]), int(sys.argv[5])
        gen = load(f"{pkg}/gen.py", "gen")
        rng = random.Random(seed)
        out = [gen.random_case(rng, size) for _ in range(count)]
    elif cmd == "brute":
        brute = load(f"{pkg}/solutions/brute.py", "brute")
        out = [brute.solve(**args) for args in json.load(sys.stdin)]
    else:
        raise SystemExit(f"unknown command {cmd}")
    json.dump(out, sys.stdout, separators=(",", ":"))


main()
