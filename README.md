# Paseo Kiro Usage

Shows Kiro account credits in Paseo's built-in **Usage** view. This is account quota, not an individual agent's token count. No iOS app modification is needed.

## How it works

The server-only Paseo plugin registers a usage source. A refresh runs `kiro-cli chat --v2 --no-interactive /usage` with the selected `KIRO_HOME`, then maps plan credits, the reset date, and optional bonus credits into Paseo's usage report. V2 is explicit: some Kiro V3 releases treat `/usage` in non-interactive mode as a model prompt instead of a slash command. If Kiro changes the text format, the card reports an error rather than showing invented values. Paseo normally caches reports for five minutes.

The plugin looks for `kiro-cli` in `KIRO_CLI_PATH`, `~/.local/bin`, or `PATH`. It does not read, copy, or refresh Kiro credentials. Account identity is based on the Kiro home directory, so different accounts must use different `KIRO_HOME` directories. Session lookup supports Paseo provider ID `kiro`. A session with its own `KIRO_API_KEY` that differs from the daemon's key is omitted to avoid showing another account's quota.

The CLI probe may create an empty Kiro history entry. It is run only when Paseo requests usage, not on every agent turn.

## Install

Requires Paseo 0.15 or later and a signed-in Kiro CLI on the same host as the Paseo daemon.

Install directly from the GitHub repository, no local build or setup needed:

```sh
paseo plugin install https://github.com/TivonJJ/paseo-plugin-kiro-usage
```

Enable plugins in Paseo Settings if they are disabled, then open **Usage**. To refresh manually, use `paseo usage ls --refresh` on the daemon host. For a manual Kiro baseline, run `kiro-cli` and enter `/usage`.

Do not install the plugin into a daemon without reviewing its code: Paseo server plugins run with the daemon user's local access.
