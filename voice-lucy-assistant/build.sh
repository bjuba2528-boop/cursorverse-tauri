#!/bin/bash

# Build script for Voice Lucy Assistant
set -e

echo "🚀 Building Voice Lucy Assistant..."

# Check requirements
echo "📋 Checking requirements..."

if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 16+"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm"
    exit 1
fi

if ! command -v cargo &> /dev/null; then
    echo "❌ Rust/Cargo is not installed. Please install Rust 1.70+"
    exit 1
fi

echo "✅ All requirements met"

# Install dependencies
echo "📦 Installing frontend dependencies..."
npm install

echo "📦 Installing Tauri CLI..."
npm install -g @tauri-apps/cli

# Build frontend
echo "🔨 Building frontend..."
npm run build

# Build Tauri app
echo "🦀 Building Tauri application..."
npm run tauri build

echo "✅ Build completed successfully!"
echo "📁 The built application is located in: src-tauri/target/release/bundle/"

# Show build info
if [ -d "src-tauri/target/release/bundle" ]; then
    echo "📦 Available bundles:"
    find src-tauri/target/release/bundle -name "*.exe" -o -name "*.dmg" -o -name "*.deb" -o -name "*.AppImage" | while read file; do
        size=$(du -h "$file" | cut -f1)
        echo "   - $(basename "$file") ($size)"
    done
fi

echo "🎉 Voice Lucy Assistant is ready to use!"