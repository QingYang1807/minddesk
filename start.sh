#!/bin/zsh
set -e
cd "${0:A:h}"
if [ ! -d node_modules ]; then npm ci; fi
if [ ! -d dist ]; then npm run build; fi
exec npm start
