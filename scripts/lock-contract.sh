#!/usr/bin/env bash
set -euo pipefail
# DESTRUCTIVE and irreversible: run manually only after the final verified deploy.
account=ww-portal-261112.testnet
rpc=https://rpc.testnet.near.org
keys=$(curl --fail --silent --show-error "$rpc" -H 'Content-Type: application/json' --data "{\"jsonrpc\":\"2.0\",\"id\":\"lock\",\"method\":\"query\",\"params\":{\"request_type\":\"view_access_key_list\",\"finality\":\"final\",\"account_id\":\"$account\"}}")
# All deletions are one atomic transaction, signed before its keys disappear.
public_keys=$(python3 -c 'import json,sys; print(",".join(k["public_key"] for k in json.load(sys.stdin)["result"]["keys"]))' <<<"$keys")
if [[ -n "$public_keys" ]]; then
  near account delete-keys "$account" public-keys "$public_keys" network-config testnet sign-with-legacy-keychain send
fi
result=$(curl --fail --silent --show-error "$rpc" -H 'Content-Type: application/json' --data "{\"jsonrpc\":\"2.0\",\"id\":\"locked\",\"method\":\"query\",\"params\":{\"request_type\":\"view_access_key_list\",\"finality\":\"final\",\"account_id\":\"$account\"}}")
printf '%s\n' "$result"
python3 -c 'import json,sys; assert json.load(sys.stdin)["result"]["keys"] == [], "contract still has access keys"' <<<"$result"
