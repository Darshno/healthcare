#!/bin/bash
# Startup script for local development with both Node and Python services

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Healthcare System - Local Development Startup${NC}"
echo ""

# Check if docker-compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ docker-compose is not installed${NC}"
    echo "Please install Docker and docker-compose"
    exit 1
fi

echo -e "${GREEN}✓${NC} Starting Docker services (PostgreSQL, Redis)..."
docker-compose up -d postgres redis

# Wait for services to be ready
echo -e "${YELLOW}Waiting for services to be ready...${NC}"
sleep 5

echo -e "${GREEN}✓${NC} Docker services started"
echo ""

# Check if environment files exist
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠${NC} Creating .env from .env.example..."
    cp .env.example .env
fi

if [ ! -f python-service/.env ]; then
    echo -e "${YELLOW}⚠${NC} Creating python-service/.env from .env.example..."
    cp python-service/.env.example python-service/.env
fi

echo ""
echo -e "${GREEN}✓ Setup complete!${NC}"
echo ""
echo "To start the application:"
echo ""
echo "1. NestJS Server:"
echo "   ${YELLOW}pnpm dev:server${NC}"
echo ""
echo "2. Python Analytics Service (in another terminal):"
echo "   ${YELLOW}cd python-service && python -m uvicorn app.main:app --reload${NC}"
echo ""
echo "3. Metro/Web Dev Server (in another terminal):"
echo "   ${YELLOW}pnpm dev:metro${NC}"
echo ""
echo "Or run everything with:"
echo "   ${YELLOW}pnpm dev${NC}"
echo ""
