#!/bin/bash

# Ensure necessary directories exist
mkdir -p /var/run/tailscale /var/cache/tailscale /var/lib/tailscale

# Start the Tailscale daemon (tailscaled) in the background
echo "Starting tailscaled..."
tailscaled --state=/var/lib/tailscale/tailscaled.state --socket=/var/run/tailscale/tailscaled.sock &

# Wait a moment for the daemon to initialize
sleep 3

# If an auth key is provided, authenticate automatically
if [ -n "${TAILSCALE_AUTH_KEY}" ]; then
    echo "Authenticating with Tailscale using provided auth key..."
    tailscale up --authkey="${TAILSCALE_AUTH_KEY}" --accept-routes --accept-dns=false
else
    echo "No TAILSCALE_AUTH_KEY provided."
    echo "You can manually authenticate by running: docker exec -it project-nova tailscale up"
fi

# Start the Project Nova server
echo "Starting Project Nova..."
npx tsx server.ts
