#!/bin/bash
export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$HOME/.nvm/versions/node/v18.20.6/bin:$PATH"
exec mcp-server-filesystem "$@"
