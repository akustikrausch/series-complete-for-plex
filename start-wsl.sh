#!/bin/bash

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║           PlexComplete WSL/Linux Startup Script               ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo

# Check if running in WSL
if grep -q Microsoft /proc/version; then
    echo "[*] WSL environment detected"
    
    # Fix the Plex DB path for WSL
    if [ -f .env ]; then
        # Update the path to use WSL format
        sed -i 's|PLEX_DB_PATH=.*|PLEX_DB_PATH=/mnt/c/Users/USERNAME/AppData/Local/Plex Media Server/Plug-in Support/Databases/com.plexapp.plugins.library.db|' .env
        echo "    ✓ Updated .env for WSL paths"
    fi
else
    echo "[*] Native Linux environment detected"
fi

# Check for sqlite3
if ! command -v sqlite3 &> /dev/null; then
    echo
    echo "⚠ SQLite3 not found!"
    echo "Please install: sudo apt-get install sqlite3"
    exit 1
fi

# Check Node.js
if ! command -v node &> /dev/null; then
    echo
    echo "⚠ Node.js not found!"
    echo "Please install Node.js first"
    exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo
    echo "[*] Installing dependencies..."
    npm install
fi

# Start the server
echo
echo "=================================================="
echo "         SERVER STARTING ON PORT 3000"
echo "         http://localhost:3000"
echo "=================================================="
echo
echo "[>] Press CTRL+C to terminate"
echo

# Run the cross-platform server
node server-crossplatform.js