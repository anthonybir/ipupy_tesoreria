#!/bin/bash
# WS-2 Phase 6 Test Helper Script
# Quick commands for smoke testing

set -e

echo "🧪 IPU PY Tesorería - Test Helper"
echo "=================================="
echo ""

# Function to check if servers are running
check_servers() {
    echo "📡 Checking development servers..."
    
    if pgrep -f "convex dev" > /dev/null; then
        echo "✅ Convex dev server is running"
    else
        echo "❌ Convex dev server NOT running"
        echo "   Start it: npx convex dev"
    fi
    
    if lsof -ti:3000 > /dev/null 2>&1; then
        echo "✅ Next.js dev server is running (port 3000)"
    else
        echo "❌ Next.js dev server NOT running"
        echo "   Start it: npm run dev"
    fi
}

# Function to validate environment
check_env() {
    echo ""
    echo "🔐 Checking environment variables..."
    
    if [ -n "$CONVEX_URL" ]; then
        echo "✅ CONVEX_URL is set"
    else
        echo "❌ CONVEX_URL not set"
    fi
    
    if [ -n "$NEXT_PUBLIC_CONVEX_URL" ]; then
        echo "✅ NEXT_PUBLIC_CONVEX_URL is set"
    else
        echo "❌ NEXT_PUBLIC_CONVEX_URL not set"
    fi
    
    if [ -n "$GOOGLE_CLIENT_ID" ]; then
        echo "✅ GOOGLE_CLIENT_ID is set"
    else
        echo "❌ GOOGLE_CLIENT_ID not set"
    fi
}

# Function to run pre-test validation
validate() {
    echo ""
    echo "🔍 Running pre-test validation..."
    
    echo "TypeScript check..."
    npm run typecheck
    
    echo ""
    echo "ESLint check..."
    npm run lint
    
    echo ""
    echo "✅ Validation complete"
}

# Function to list Convex functions
list_functions() {
    echo ""
    echo "📋 Convex functions..."
    npx convex function list | grep -E "auth:|reports:|admin:"
}

# Main menu
case "${1:-help}" in
    check)
        check_servers
        check_env
        ;;
    validate)
        validate
        ;;
    functions)
        list_functions
        ;;
    all)
        check_servers
        check_env
        validate
        list_functions
        ;;
    *)
        echo "Usage: ./scripts/test-helper.sh [command]"
        echo ""
        echo "Commands:"
        echo "  check      - Check if dev servers are running"
        echo "  validate   - Run TypeScript + ESLint checks"
        echo "  functions  - List relevant Convex functions"
        echo "  all        - Run all checks"
        echo ""
        echo "Examples:"
        echo "  ./scripts/test-helper.sh check"
        echo "  ./scripts/test-helper.sh validate"
        echo "  ./scripts/test-helper.sh all"
        ;;
esac
