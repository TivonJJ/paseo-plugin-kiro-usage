# Paseo Kiro Usage

Shows Kiro account credits in Paseo's built-in **Usage** view. This is account quota, not an individual agent's token count. No iOS app modification is needed.

## How it works

The server-only Paseo plugin registers a usage source. A refresh starts `kiro-cli acp --agent-engine=v3` with the selected `KIRO_HOME` and requests `_kiro/account/getUsage`. It maps the structured plan credits, reset date, and optional bonus credits into Paseo's usage report. Some Kiro releases implement this method without advertising it, so the plugin tries the request directly. If the V3 method is unavailable, it falls back to `kiro-cli chat --v2 --no-interactive /usage`. Authentication failures and malformed V3 usage data are reported as errors instead of silently using the legacy path. Paseo normally caches reports for five minutes.

The plugin looks for `kiro-cli` in `KIRO_CLI_PATH`, `~/.local/bin`, or `PATH`. It does not read, copy, or refresh Kiro credentials. Account identity is based on the Kiro home directory, so different accounts must use different `KIRO_HOME` directories. Session lookup supports Paseo provider ID `kiro`. A session with its own `KIRO_API_KEY` that differs from the daemon's key is omitted to avoid showing another account's quota.

The legacy V2 fallback may create an empty Kiro history entry. The plugin queries usage only when Paseo requests it, not on every agent turn.

## Install

Requires Paseo 0.15 or later and a signed-in Kiro CLI on the same host as the Paseo daemon.

Install directly from the GitHub repository, no local build or setup needed:

```sh
paseo plugin install https://github.com/TivonJJ/paseo-plugin-kiro-usage
```

Enable plugins in Paseo Settings if they are disabled, then open **Usage**. To refresh manually, use `paseo usage ls --refresh` on the daemon host. For a manual Kiro baseline, run `kiro-cli` and enter `/usage`.

Do not install the plugin into a daemon without reviewing its code: Paseo server plugins run with the daemon user's local access.
