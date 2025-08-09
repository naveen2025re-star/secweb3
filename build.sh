#!/bin/bash
set -e

echo "🔄 Starting build process..."

# Clean npm cache
echo "🧹 Cleaning npm cache..."
npm cache clean --force || true

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
npm install --no-audit --no-fund

# Build frontend
echo "🏗️ Building frontend..."
npm run build

# Navigate to server and install dependencies
echo "📦 Installing server dependencies..."
cd server
npm cache clean --force || true
rm -f package-lock.json
npm install --no-audit --no-fund

# Verify critical dependencies are installed
echo "🔍 Verifying server dependencies..."
npm ls pg || echo "❌ pg not found"
npm ls jsonwebtoken || echo "❌ jsonwebtoken not found" 
npm ls ethers || echo "❌ ethers not found"
npm ls express || echo "❌ express not found"

# List what's actually installed
echo "📦 Installed packages:"
ls -la node_modules/ | grep -E "(pg|jsonwebtoken|ethers|express)" || echo "No matching packages found"

echo "✅ Build completed successfully!"
