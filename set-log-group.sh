#!/usr/bin/env bash

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  echo "This script must be sourced."
  echo "Usage: source set-log-group.sh [label]"
  exit 1
fi

LABEL=${1:-spotify_library}
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
export REQUEST_LOG_GROUP="${TIMESTAMP}_${LABEL}"

mkdir -p logs last_run_raw_output

echo "REQUEST_LOG_GROUP set to: ${REQUEST_LOG_GROUP}"
echo "Logs will be written to logs/${REQUEST_LOG_GROUP}.log"
