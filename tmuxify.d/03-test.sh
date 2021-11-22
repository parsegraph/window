#!/bin/bash
while true; do
    npm run autotest
    inotifywait -e modify -r package*.json tsconfig.json .babelrc webpack* src test
done
