# Project Nova: Field Manual

Project Nova is a modern, web-based virtualization management platform, designed as a lightweight alternative to Proxmox VE.

## System Architecture

```ascii
+-----------------------------------------------------------------------+
|                          Web Browser (Client)                         |
+-----------------------------------------------------------------------+
                                     | HTTPS/WSS
+-----------------------------------------------------------------------+
|                    Project Nova (Node.js/Express)                     |
| +-----------------+   +-----------------------------+   +-----------+ |
| |  Auth/JWT/WS    |   |    API Routes (REST)        |   | Monitoring| |
| +-----------------+   +-----------------------------+   +-----------+ |
|           |                       |                           |       |
| +-----------------+   +-----------------------------+   +-----------+ |
| | SQLite Database |   |   Libvirt/LXC/System Wrappers|   | Metrics   | |
| +-----------------+   +-----------------------------+   +-----------+ |
+-----------------------------------------------------------------------+
                                     | System Commands (virsh, ip, etc.)
+-----------------------------------------------------------------------+
|                 Linux Host (KVM/QEMU, LXC, iptables)                  |
+-----------------------------------------------------------------------+
|                                Hardware                               |
+-----------------------------------------------------------------------+
```

## Folder Structure

```text
/
├── data/               # SQLite database files
├── iso_uploads/        # ISO image storage
├── src/                # Frontend React application
│   ├── components/     # Reusable UI components
│   ├── lib/            # Utility functions (including advanced KVM)
│   └── ...
├── auth.ts             # Authentication logic
├── database.ts         # Database initialization
├── libvirt.ts          # Core system virtualization wrappers
├── monitoring.ts       # System monitoring logic
├── network.ts          # Networking configuration
├── server.ts           # Main Express server entry point
├── setup.ts            # Environment setup
└── install.sh          # One-click installation script
```

## Installation

### Prerequisites
Project Nova requires a Linux host with the following virtualization and networking tools installed:
- **Node.js** (v18+)
- **libvirt** (with `qemu-kvm`)
- **virt-install**, **virt-clone**
- **lxc**, **iptables**, **lsblk**
- **SQLite3**

### One-Click Install
1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd project-nova
   ```

2. **Run the installation script:**
   ```bash
   chmod +x install.sh
   sudo ./install.sh
   ```

3. **Log out and log back in** for group permission changes (libvirt) to take effect.

## Configuration

1. **Environment Variables:**
   Copy `.env.example` to `.env` and fill in the required values:
   ```bash
   cp .env.example .env
   # Edit .env and set JWT_SECRET, GUAC_KEY, etc.
   ```

2. **Start the application:**
   ```bash
   npm install
   npm run dev
   ```

3. **Database:** 
   The application automatically initializes a SQLite database (`nova.db`) in the `data/` directory upon the first server start. 
   
   *Note: If you see `data/` or `nova.db` marked in red in your editor, this usually indicates that the files have not been created yet or are untracked by your version control. This is normal behavior. Simply run the server (`npm run dev`) to trigger the initialization process.*

4. **Permissions:** Ensure the user running the application is part of the `libvirt` group to interact with `virsh` and other virtualization tools.

## Advanced KVM Features

Project Nova supports advanced KVM/QEMU features for performance tuning and specialized hardware configurations:

- **CPU Pinning/Affinity:** Optimize VM performance by pinning virtual CPUs to specific physical CPU cores.
- **NUMA Topology:** Configure NUMA nodes to improve memory access latency for high-performance workloads.
- **PCIe Passthrough:** Directly attach PCIe devices (e.g., GPUs, NICs) to VMs for near-native performance.
- **Storage QoS:** Set I/O throttling limits to ensure fair resource allocation in multi-tenant environments.
- **External Snapshots:** Create atomic, disk-only snapshots for advanced backup and recovery scenarios.

*Note: These features require appropriate hardware support (e.g., VT-d/AMD-Vi for PCIe passthrough) and may require host-level configuration.*

## Troubleshooting

- **"Permission Denied" when running VM commands:** Ensure the user running the Node.js server is in the `libvirt` group.
- **VM creation fails:** Check the logs in the terminal. Ensure the ISO path is accessible by the `libvirt` service.
- **WebSocket connection issues:** Ensure your reverse proxy is configured to proxy WebSocket connections (`Upgrade` headers) to port 3000.
- **Database errors:** Check the permissions of the `data/` directory.
