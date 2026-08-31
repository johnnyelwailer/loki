#!/bin/bash

set -Eeuo pipefail

assert_contains() {
  FILENAME=$1
  EXPECTED_CONTENT=$2

  if [[ "$(cat $FILENAME)" == *"${EXPECTED_CONTENT}"* ]]; then
    return 0
  else
    echo "Unable to find $EXPECTED_CONTENT in $FILENAME"
    return 1
  fi
}

# Ensure we're in the correct folder
pushd "$( dirname "${BASH_SOURCE[0]}" )" > /dev/null

# Scaffold a new CRA project with storybook and loki
mkdir -p generated
cd generated
rm -rf create-react-app || true
yarn create react-app create-react-app
cd create-react-app
npx storybook@latest init --yes --package-manager=yarn1 --type react_scripts
yarn add loki
../../../../node_modules/.bin/loki init

# Ensure modifications has been made
if command -v docker > /dev/null 2>&1; then
  DEFAULT_TARGET=chrome.docker
else
  DEFAULT_TARGET=chrome.app
fi

assert_contains "package.json" "$(cat <<-END
  "loki": {
    "configurations": {
      "chrome.laptop": {
        "target": "${DEFAULT_TARGET}",
        "width": 1366,
        "height": 768,
        "deviceScaleFactor": 1,
        "mobile": false
      },
      "chrome.iphone7": {
        "target": "${DEFAULT_TARGET}",
        "preset": "iPhone 7"
      }
    }
  }
END
)"

# Ensure we can snap stories
yarn build-storybook --quiet
mkdir -p .loki/reference
cp ../../fixtures/chrome_laptop_Welcome_to_Storybook.png ./.loki/reference

yarn storybook --no-open 2> error.log > output.log &
STORYBOOK_PID=$!

yarn loki test laptop --requireReference --storiesFilter Welcome --reactUri http://localhost:6006

kill $STORYBOOK_PID

# Peace out
popd > /dev/null
