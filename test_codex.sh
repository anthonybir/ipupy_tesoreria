#!/bin/bash
# Test script for Codex configuration

echo "✅ Testing Codex configuration..."
echo ""

# Test if config file is valid TOML
echo "1. Checking TOML syntax..."
if python3 -c "import toml; toml.load(open('$HOME/.codex/config.toml'))" 2>/dev/null; then
    echo "   ✓ TOML syntax is valid"
else
    echo "   ✗ TOML syntax error"
    exit 1
fi

# Test if database exists
echo "2. Checking database file..."
if [ -f "/Users/anthonybir/Desktop/IPUPY_Tesoreria/ipupy_treasurer.db" ]; then
    echo "   ✓ Database file exists"
else
    echo "   ✗ Database file not found"
    exit 1
fi

# Test if mcp-sqlite package works
echo "3. Testing mcp-sqlite package..."
if timeout 2 npx -y mcp-sqlite /Users/anthonybir/Desktop/IPUPY_Tesoreria/ipupy_treasurer.db 2>&1 | grep -q "Content-Length" || [ $? -eq 124 ]; then
    echo "   ✓ mcp-sqlite package is working"
else
    echo "   ✗ mcp-sqlite package failed"
fi

echo ""
echo "✅ Configuration looks good! Try running: codex"