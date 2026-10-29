# syntax=docker/dockerfile:1.7
# KingCoda judge box (Phase 1 spike): Python, JavaScript and C++ behind kc-run + kc-exec.
#
# Optional build-time extras for networks that re-terminate TLS (never needed on Cloudflare):
#   --secret id=ca,src=/path/to/ca.crt --build-arg HTTPS_PROXY=...

ARG DEBIAN=mirror.gcr.io/library/debian:trixie-slim
ARG GOLANG=mirror.gcr.io/library/golang:1.25-trixie

FROM ${GOLANG} AS build
WORKDIR /src
COPY kc-exec/kc-exec.c kc-exec/
RUN gcc -O2 -Wall -Wextra -Werror -static -o /out-kc-exec kc-exec/kc-exec.c
COPY kc-run/ kc-run/
RUN cd kc-run && CGO_ENABLED=0 go build -trimpath -ldflags='-s -w' -o /out-kc-run .

FROM ${DEBIAN}
ARG HTTPS_PROXY
# apt helper: uses the optional CA secret and proxy when present (see header), plain HTTP otherwise.
RUN cat > /usr/local/sbin/kc-apt <<'SH' && chmod 0755 /usr/local/sbin/kc-apt
#!/bin/sh
set -eu
opts=""
if [ -f /run/secrets/ca ]; then
  sed -i 's#http://deb.debian.org#https://deb.debian.org#g' /etc/apt/sources.list.d/debian.sources
  opts="-o Acquire::https::CAInfo=/run/secrets/ca"
  [ -n "${HTTPS_PROXY:-}" ] && opts="$opts -o Acquire::https::Proxy=$HTTPS_PROXY"
fi
apt-get $opts update
apt-get $opts install -y --no-install-recommends "$@"
rm -rf /var/lib/apt/lists/*
SH
# One toolchain per layer keeps each layer small for registry uploads and lets languages change independently.
RUN --mount=type=secret,id=ca,required=false,mode=0444 kc-apt tini python3
RUN --mount=type=secret,id=ca,required=false,mode=0444 kc-apt nodejs
RUN --mount=type=secret,id=ca,required=false,mode=0444 kc-apt libc6-dev
RUN --mount=type=secret,id=ca,required=false,mode=0444 kc-apt g++ && rm /usr/local/sbin/kc-apt

# The sandbox user owns nothing in the image. /work is traversable but not listable by it.
RUN groupadd -g 2000 sandbox && useradd -u 2000 -g 2000 -M -d /nonexistent -s /usr/sbin/nologin sandbox \
 && mkdir -p /opt/kc /work && chmod 0711 /work \
 && precompile_check=$(python3 -c 'print(1)') && test "$precompile_check" = 1

COPY --from=build /out-kc-exec /opt/kc/kc-exec
COPY --from=build /out-kc-run /opt/kc/kc-run
RUN chmod 0755 /opt/kc/kc-exec /opt/kc/kc-run

EXPOSE 8080
USER root
# tini is PID 1 so orphaned sandbox processes are reaped; zombies would otherwise count
# against RLIMIT_NPROC and break later jobs.
ENTRYPOINT ["/usr/bin/tini", "--", "/opt/kc/kc-run"]
