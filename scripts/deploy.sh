#!/bin/bash

# ==============================================================================
# IPU PY Tesorería - Next.js Deployment Script
# ==============================================================================
# This script handles deployment of the Next.js application to various platforms
# ==============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="ipupy-nextjs"
DEPLOY_BRANCH="main"

# Functions
print_header() {
    echo -e "${BLUE}============================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}============================================${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

check_requirements() {
    print_header "Checking Requirements"

    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed"
        exit 1
    fi
    print_success "Node.js $(node --version) found"

    # Check npm
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed"
        exit 1
    fi
    print_success "npm $(npm --version) found"

    # Check git
    if ! command -v git &> /dev/null; then
        print_error "git is not installed"
        exit 1
    fi
    print_success "git $(git --version | cut -d' ' -f3) found"

    # Check for .env.local
    if [ ! -f ".env.local" ]; then
        print_warning ".env.local not found. Creating from template..."
        cp .env.example .env.local
        print_error "Please update .env.local with your configuration"
        exit 1
    fi
    print_success ".env.local found"
}

run_tests() {
    print_header "Running Tests"

    # Lint
    print_success "Running ESLint..."
    npm run lint || {
        print_warning "Lint warnings found (continuing deployment)"
    }

    # Type check
    print_success "Running TypeScript type check..."
    npx tsc --noEmit || {
        print_error "TypeScript errors found"
        exit 1
    }

    print_success "All tests passed"
}

build_application() {
    print_header "Building Application"

    # Clean previous build
    rm -rf .next
    print_success "Cleaned previous build"

    # Build application
    print_success "Building Next.js application..."
    npm run build || {
        print_error "Build failed"
        exit 1
    }

    print_success "Build completed successfully"
}

deploy_vercel() {
    print_header "Deploying to Vercel"

    # Check if Vercel CLI is installed
    if ! command -v vercel &> /dev/null; then
        print_warning "Vercel CLI not installed. Installing..."
        npm i -g vercel
    fi

    # Deploy
    print_success "Starting Vercel deployment..."
    vercel --prod || {
        print_error "Vercel deployment failed"
        exit 1
    }

    print_success "Deployed to Vercel successfully"
}

deploy_docker() {
    print_header "Building Docker Image"

    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed"
        exit 1
    fi

    # Build Docker image
    print_success "Building Docker image..."
    docker build -t $PROJECT_NAME:latest . || {
        print_error "Docker build failed"
        exit 1
    }

    print_success "Docker image built successfully"

    # Option to run container
    read -p "Do you want to run the Docker container? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker run -d \
            --name $PROJECT_NAME \
            -p 3000:3000 \
            --env-file .env.local \
            --restart unless-stopped \
            $PROJECT_NAME:latest

        print_success "Docker container started on port 3000"
    fi
}

deploy_manual() {
    print_header "Manual Deployment"

    print_success "Application built successfully"
    echo
    echo "To deploy manually:"
    echo "1. Copy the following directories to your server:"
    echo "   - .next/"
    echo "   - public/"
    echo "   - package.json"
    echo "   - package-lock.json"
    echo "   - next.config.ts"
    echo
    echo "2. On the server, run:"
    echo "   npm ci --production"
    echo "   npm run start"
    echo
    print_success "Manual deployment files ready"
}

# Main script
print_header "IPU PY Tesorería - Deployment Script"

# Check requirements
check_requirements

# Install dependencies
print_header "Installing Dependencies"
npm ci
print_success "Dependencies installed"

# Run tests
run_tests

# Build application
build_application

# Select deployment method
print_header "Select Deployment Method"
echo "1) Vercel (Recommended)"
echo "2) Docker"
echo "3) Manual"
echo "4) Exit"

read -p "Enter choice [1-4]: " choice

case $choice in
    1)
        deploy_vercel
        ;;
    2)
        deploy_docker
        ;;
    3)
        deploy_manual
        ;;
    4)
        print_success "Deployment cancelled"
        exit 0
        ;;
    *)
        print_error "Invalid choice"
        exit 1
        ;;
esac

print_header "Deployment Complete!"
print_success "Application has been deployed successfully"