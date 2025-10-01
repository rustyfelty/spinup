# SpinUp Generic Game Server Container (Multi-arch)
# Lightweight version without Wine (works on ARM64 and AMD64)
# For full Wine support on AMD64, use Dockerfile.amd64
FROM ubuntu:22.04

LABEL maintainer="SpinUp"
LABEL description="Generic container for running game servers with custom scripts"
LABEL version="1.0.0"

ENV DEBIAN_FRONTEND=noninteractive

# Install base dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    wget \
    unzip \
    tar \
    xz-utils \
    bzip2 \
    build-essential \
    git \
    netcat-traditional \
    iproute2 \
    procps \
    jq \
    python3 \
    python3-pip \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for running servers
RUN useradd -m -u 1000 -s /bin/bash gameserver && \
    mkdir -p /data /startup && \
    chown -R gameserver:gameserver /data /startup

# Switch to non-root user
USER gameserver
WORKDIR /data

# Volume for game server data
VOLUME ["/data"]

# Entrypoint will execute the custom startup script
COPY --chown=gameserver:gameserver entrypoint.sh /startup/entrypoint.sh
USER root
RUN chmod +x /startup/entrypoint.sh
USER gameserver

ENTRYPOINT ["/startup/entrypoint.sh"]
