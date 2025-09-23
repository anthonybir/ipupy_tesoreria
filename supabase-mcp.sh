#!/bin/bash
export SUPABASE_ACCESS_TOKEN="sbp_9e93d5fbcb195f4f92e1140f748de2727c2d2196"
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
npx -y @supabase/mcp-server-supabase@latest --read-only --project-ref=vnxghlfrmmzvlhzhontk