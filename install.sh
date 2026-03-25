#!/bin/bash

# Project Nova - Zero-Touch Installation Script
# This script automates the setup of the Project Nova Hypervisor Management Platform.

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}====================================================${NC}"
echo -e "${BLUE}          PROJECT NOVA - INSTALLATION               ${NC}"
echo -e "${BLUE}====================================================${NC}"

# 1. Ask for essential information
echo -e "${GREEN}[1/4] System Configuration${NC}"
read -p "Enter Admin Username [admin]: " ADMIN_USER
ADMIN_USER=${ADMIN_USER:-admin}

read -s -p "Enter Admin Password: " ADMIN_PASS
echo ""
if [ -z "$ADMIN_PASS" ]; then
    echo -e "${RED}Error: Password cannot be empty.${NC}"
    exit 1
fi

read -p "Enter Host IP Address [127.0.0.1]: " HOST_IP
HOST_IP=${HOST_IP:-127.0.0.1}

read -p "Enter Computer Name [nova-node-01]: " COMP_NAME
COMP_NAME=${COMP_NAME:-nova-node-01}

read -p "Enter DNS Server [8.8.8.8]: " DNS_SERVER
DNS_SERVER=${DNS_SERVER:-8.8.8.8}

# 2. Install Dependencies
echo -e "\n${GREEN}[2/4] Installing Dependencies...${NC}"
# In a real environment, we would run:
# sudo apt-get update && sudo apt-get install -y qemu-kvm libvirt-daemon-system libvirt-clients bridge-utils virtinst libvirt-dev
echo "Skipping OS package installation (running in containerized environment)..."

echo "Installing Node.js packages..."
npm install

# 3. Configure Environment
echo -e "\n${GREEN}[3/4] Configuring Environment...${NC}"
cat <<EOF > .env
JWT_SECRET=$(openssl rand -base64 32)
GUAC_KEY=$(openssl rand -hex 16)
HOST_IP=$HOST_IP
COMPUTER_NAME=$COMP_NAME
DNS_SERVER=$DNS_SERVER
NODE_ENV=production
EOF

cat <<EOF > .env.example
JWT_SECRET=
GUAC_KEY=
HOST_IP=
COMPUTER_NAME=
DNS_SERVER=
EOF

echo "Environment variables generated in .env"

# 4. Initialize Database
echo -e "\n${GREEN}[4/4] Initializing Database...${NC}"
# We'll use a small node script to seed the admin user
node -e "
const db = require('better-sqlite3')('nova.db');
const bcrypt = require('bcryptjs');
const password = '$ADMIN_PASS';
const salt = bcrypt.genSaltSync(10);
const hash = bcrypt.hashSync(password, salt);

db.prepare('CREATE TABLE IF NOT EXISTS Users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, password TEXT, role TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)').run();
db.prepare('INSERT OR REPLACE INTO Users (id, username, password, role) VALUES (1, \"$ADMIN_USER\", ?, \"admin\")').run(hash);
console.log('Admin user $ADMIN_USER created successfully.');
"

echo -e "\n${GREEN}====================================================${NC}"
echo -e "${GREEN}          INSTALLATION COMPLETE!                    ${NC}"
echo -e "${GREEN}====================================================${NC}"
echo -e "You can now start the platform by running: ${BLUE}npm run dev${NC}"
echo -e "Access the dashboard at: ${BLUE}http://$HOST_IP:3000${NC}"
echo -e "===================================================="
