#!/usr/bin/env bash
# exit on error
set -o errexit

npm install
npm run build

# Install Chromium explicitly for Puppeteer
npx puppeteer browsers install chrome
