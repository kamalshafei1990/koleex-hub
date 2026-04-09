#!/bin/bash
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
cd "/Users/kamalshafei/Desktop/Koleex HUB"
exec "/Users/kamalshafei/Desktop/Koleex HUB/node_modules/.bin/next" dev --port "${PORT:-3199}"
