#!/bin/bash

# Development script for Voice Lucy Assistant
set -e

echo "🛠️  Starting Voice Lucy Assistant in development mode..."

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

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    npm install
fi

# Check Tauri CLI
if ! command -v tauri &> /dev/null; then
    echo "📦 Installing Tauri CLI..."
    npm install -g @tauri-apps/cli
fi

# Start development server
echo "🚀 Starting development server..."
echo "🌐 The application will open in a new window"
echo "📝 Logs will appear below"
echo "⚡ Hot reload is enabled - changes will be applied automatically"
echo ""
echo "🎮 Controls:"
echo "   - Close the window to stop the server"
echo "   - Check the console for debugging information"
echo ""

npm run tauri dev