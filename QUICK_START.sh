#!/bin/bash

echo "🚀 Productivity Tracker - Quick Start"
echo "===================================="
echo ""

# Check if Node is installed
if ! command -v node &> /dev/null
then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

echo "✓ Node.js found: $(node --version)"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
echo ""

echo "🔧 Backend dependencies..."
cd backend
npm install --silent
if [ $? -ne 0 ]; then
    echo "❌ Failed to install backend dependencies"
    exit 1
fi

echo "✓ Backend dependencies installed"
echo ""

echo "🔧 Frontend dependencies..."
cd ../frontend
npm install --silent
if [ $? -ne 0 ]; then
    echo "❌ Failed to install frontend dependencies"
    exit 1
fi

echo "✓ Frontend dependencies installed"
echo ""

cd ..

echo "=================================="
echo "✓ Setup Complete!"
echo ""
echo "📝 Next Steps:"
echo ""
echo "1. Terminal 1 - Start Backend:"
echo "   cd backend && npm start"
echo ""
echo "2. Terminal 2 - Start Frontend:"
echo "   cd frontend && npm run dev"
echo ""
echo "3. Open browser at http://localhost:3000"
echo ""
echo "📚 Read SETUP_GUIDE.md for initial data setup"
echo ""
