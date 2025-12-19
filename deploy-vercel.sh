#!/bin/bash

# Vercel Deployment Script for Performance Analyzer
# This script helps you deploy the app to Vercel for free

echo "🚀 Performance Analyzer - Vercel Deployment Script"
echo "=================================================="

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "api" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    echo "Make sure package.json and api/ folder exist"
    exit 1
fi

echo ""
echo "📋 Pre-deployment Checklist:"
echo "✅ MongoDB Atlas account created"
echo "✅ GitHub repository created"
echo "✅ Vercel account created"
echo ""

# Step 1: Install dependencies
echo "📦 Installing dependencies..."
npm install

# Step 2: Build the frontend
echo "🏗️  Building frontend..."
npm run build

# Step 3: Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo ""
    echo "🔧 Installing Vercel CLI..."
    npm install -g vercel
fi

echo ""
echo "🌐 Deployment Instructions:"
echo "=========================="
echo ""
echo "1. Push to GitHub:"
echo "   git init"
echo "   git add ."
echo "   git commit -m 'Initial commit'"
echo "   git branch -M main"
echo "   git remote add origin YOUR_GITHUB_REPO_URL"
echo "   git push -u origin main"
echo ""
echo "2. Deploy to Vercel:"
echo "   - Go to https://vercel.com"
echo "   - Click 'New Project'"
echo "   - Import your GitHub repository"
echo "   - Framework: Vite"
echo "   - Build Command: npm run build"
echo "   - Output Directory: dist"
echo "   - Install Command: npm install"
echo ""
echo "3. Add Environment Variables in Vercel:"
echo "   - MONGODB_URI: your_mongodb_atlas_connection_string"
echo "   - NODE_ENV: production"
echo "   - VITE_API_URL: https://your-app.vercel.app/api"
echo "   - VITE_BACKEND_URL: https://your-app.vercel.app/api"
echo ""
echo "4. Deploy!"
echo "   - Click 'Deploy'"
echo "   - Wait for build to complete"
echo ""
echo "📖 For detailed instructions, see: VERCEL_DEPLOYMENT_GUIDE.md"
echo ""
echo "🎉 Happy deploying!"
