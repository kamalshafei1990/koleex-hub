#!/bin/bash
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
cd "/Users/kamalshafei/Desktop/Koleex HUB"
exec npx next dev --port "${PORT:-3199}"
