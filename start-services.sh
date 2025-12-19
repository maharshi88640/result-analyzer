#!/bin/bash

# Port Conflict Resolution Script
echo "=== Port Conflict Resolution for Performance Analyzer ==="

# Kill any existing processes on our target ports
echo "🛑 Stopping existing services..."
killall -9 node 2>/dev/null || true
killall -9 vite 2>/dev/null || true

sleep 3

# Check if ports are now free
echo ""
echo "🔍 Checking port availability:"
echo -n "Port 5173 (Main Frontend): "
if lsof -ti:5173 > /dev/null 2>&1; then
    echo "❌ Still in use"
    lsof -ti:5173 | xargs kill -9 2>/dev/null || true
else
    echo "✅ Available"
fi

echo -n "Port 5174 (Nested Frontend): "
if lsof -ti:5174 > /dev/null 2>&1; then
    echo "❌ Still in use"
    lsof -ti:5174 | xargs kill -9 2>/dev/null || true
else
    echo "✅ Available"
fi

echo -n "Port 5002 (Backend): "
if lsof -ti:5002 > /dev/null 2>&1; then
    echo "✅ Running (PID: $(lsof -ti:5002))"
else
    echo "❌ Not running"
fi

echo ""
echo "=== Starting Services in Order ==="
echo "1. Backend server on port 5002..."
cd /Users/maharshipatel/Downloads/Performance-analyzer-main-3/server
npm run dev > /tmp/backend.log 2>&1 &
BACKEND_PID=$!
echo "Backend started (PID: $BACKEND_PID)"

sleep 5

echo "2. Main frontend on port 5173..."
cd /Users/maharshipatel/Downloads/Performance-analyzer-main-3
npm run dev > /tmp/frontend.log 2>&1 &
FRONTEND_PID=$!
echo "Frontend started (PID: $FRONTEND_PID)"

sleep 3

echo ""
echo "=== Final Status Check ==="
echo "Backend (5002): $(lsof -ti:5002 > /dev/null && echo '✅ Running' || echo '❌ Failed')"
echo "Frontend (5173): $(lsof -ti:5173 > /dev/null && echo '✅ Running' || echo '❌ Failed')"

echo ""
echo "📊 Service URLs:"
echo "  - Main Frontend: http://localhost:5173"
echo "  - Backend API: http://localhost:5002"
echo "  - Nested Frontend: http://localhost:5174"

echo ""
echo "📝 Logs:"
echo "  - Backend: tail -f /tmp/backend.log"
echo "  - Frontend: tail -f /tmp/frontend.log"

echo ""
echo "🛑 To stop all services: killall -9 node vite"
