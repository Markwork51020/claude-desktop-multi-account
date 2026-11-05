# Claude Multi: multiple accounts for Claude Desktop on Windows

**English** | [Русский](README.ru.md)

Run several Claude Desktop accounts at the same time, side by side. Claude Multi is a small launcher for the **real Claude Desktop app**, not a web wrapper. Every copy is the full app with its own login, including Claude Code and MCP.

Claude Desktop signs in to one account at a time. If you switch between a work and a personal account, or between several subscriptions, you normally have to log out and back in. With Claude Multi, you click an account and its window opens next to the others.

> Unofficial community project. Not affiliated with, endorsed by, or supported by Anthropic. "Claude" is a trademark of Anthropic. You are responsible for following the [terms](https://www.anthropic.com/legal/consumer-terms) that apply to your accounts.

## Features

- **Separate logins.** Each copy of Claude Desktop keeps its own session, so accounts stay signed in at the same time.
- **One workspace.** Open the same project folder from different accounts.
- **Shared settings and MCP.** Each copy takes MCP servers and settings from your main Claude when it starts. You can turn this off.
- **Shared Claude Code history.** All copies see the same Code sessions. You can turn this off.
- **Email login goes to the right copy.** The sign-in link from the email opens in the copy that is waiting for it, not in your main Claude.
- **Desktop shortcuts** for each account.
- **Your main Claude stays as it is.** It keeps working as usual, and its data is only read or shared if you leave the sharing options on.

## Install

**Requirements:** Windows 10 or 11, and [Claude Desktop](https://claude.ai/download) from the Microsoft Store.

1. Download `ClaudeMulti-win32-x64.zip` from [Releases](../../releases).
2. Unpack it and run `ClaudeMulti.exe`. The build is not code-signed, so Windows SmartScreen may warn you: choose **More info → Run anyway**, or build it yourself from source.

## Add an account

1. Click **+ Add account** and enter a name. A separate Claude window opens with an empty login.
2. Sign in with your email and open the link from the message.
3. The first time, Windows asks which app should open the link. Choose **Claude Multi** and tick **Always use this app**.

The link goes to the copy you opened most recently that is still waiting for a login. To sign in to an existing copy again, use **⋯ → Sign in again** first.

## How it works

Claude Multi starts the official app with its own `--user-data-dir` for each account, which gives every copy its own login and data. It does not patch or modify Claude Desktop and has no server of its own. Sign-in links are passed straight to the copy and are never saved or logged. With shared settings on, the MCP config, including any secrets you keep in it, is copied into each profile on your computer.

| What | Where |
| --- | --- |
| Accounts and profiles | `%USERPROFILE%\.claude-multi` |
| Link handler (current user only) | `HKCU\Software\Classes\ClaudeMulti.Link`, `HKCU\Software\ClaudeMulti` |
| App registration (current user only) | `Claude Multi` value in `HKCU\Software\RegisteredApplications` |

Shared history is a directory junction from each copy's session folder to the main one.

## Limitations

- **Windows only**, and only the Microsoft Store version of Claude Desktop for now.
- **Do not open the same Code session in two copies at once.** They write to the same files.
- **Connector sign-ins.** OAuth callbacks for MCP connectors started in a copy go to your main Claude.
- **Google and SSO sign-in** links are routed too, but email login is the path tested most.
- **Claude Desktop updates can break this.** The launcher relies on how the app behaves today, not on a supported API.

## Uninstall

1. Delete the app folder. Remove `%USERPROFILE%\.claude-multi` if you also want to delete the copies' logins and data.
2. Remove the registry entries:

```bash
reg delete "HKCU\Software\Classes\ClaudeMulti.Link" /f
```

```bash
reg delete "HKCU\Software\ClaudeMulti" /f
```

```bash
reg delete "HKCU\Software\RegisteredApplications" /v "Claude Multi" /f
```

## Build from source

```bash
npm install
```

```bash
npm run build
```

The result is in `dist\ClaudeMulti-win32-x64`. Link routing only works in the packaged build, not with `npm start`.

## License

[MIT](LICENSE)
