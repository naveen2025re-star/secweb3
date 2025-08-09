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
npm install --no-audit --no-fund

echo "✅ Build completed successfully!"
