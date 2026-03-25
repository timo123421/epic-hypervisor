FROM node:22-bookworm

# Install required system dependencies: libvirt, qemu, networking tools, and Tailscale
RUN apt-get update && apt-get install -y \
    curl \
    sudo \
    iptables \
    iproute2 \
    libvirt-clients \
    qemu-utils \
    dnsutils \
    iputils-ping \
    && curl -fsSL https://tailscale.com/install.sh | sh \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy application source
COPY . .

# Build the frontend
RUN npm run build

# Make entrypoint executable
RUN chmod +x /app/entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["/app/entrypoint.sh"]
