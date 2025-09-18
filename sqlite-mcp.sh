#!/bin/bash
export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$HOME/.nvm/versions/node/v18.20.6/bin:$PATH"
# Use the existing ipupy_treasurer.db or create if doesn't exist
DB_PATH="${1:-/Users/anthonybir/Desktop/IPUPY_Tesoreria/ipupy_treasurer.db}"
exec mcp-sqlite-server "$DB_PATH" "$@"
