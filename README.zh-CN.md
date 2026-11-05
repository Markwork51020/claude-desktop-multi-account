# Claude Multi：Claude Desktop 多开工具，在 Windows 上同时登录多个账号

[English](README.md) | [Русский](README.ru.md) | **简体中文**

Claude Multi 是一款免费开源的启动器，可以在 Windows 上同时打开多个**真正的 Claude Desktop 应用**（多开、双开、多账号），无需退出登录，也不是网页套壳。每个窗口都是完整的应用，拥有独立的登录状态，包括 Claude Code 和 MCP。邮件中的登录链接会在发起登录的窗口中打开，而不是进入主 Claude。

<p align="center"><img src="docs/screenshot-zh-CN.png" alt="Claude Multi 窗口：主账号、已打开的“工作”账号、正在等待邮件登录链接的“个人”账号，以及“客户”账号" width="380"></p>

> 非官方社区项目，与 Anthropic 无关，也未获其认可或支持。“Claude”是 Anthropic 的商标。您需要自行遵守账号适用的[条款](https://www.anthropic.com/legal/consumer-terms)。

> **地区说明：** Claude Multi 不提供 Claude 的访问权限，也不会改变服务可用的地区。它只是启动您电脑上已安装的官方应用。Anthropic 的[支持地区列表](https://www.anthropic.com/supported-countries)目前未包含中国大陆和香港，请先查看该列表。

## 是否适合您

**适合**使用 Windows 和 Microsoft Store 版 Claude Desktop，并且希望：

- 同时打开工作账号和个人账号；
- 用不同账号处理同一个项目文件夹；
- 在账号之间共享 MCP 服务器、设置和 Claude Code 历史；
- 避免邮件登录链接打开到错误的 Claude 窗口。

**不适合**以下需求：

- **macOS：** 本启动器仅支持 Windows。可以看看 [claude-multiprofile](https://github.com/jmdarre-v/claude-multiprofile)。
- **完全隔离的账号：** 共享选项默认开启。可以关闭，但专门为隔离设计的工具可能更合适。
- **只在终端使用 Claude Code：** 这种情况不需要桌面启动器。

## 功能

- **独立登录。** 每个 Claude Desktop 副本保存自己的会话，多个账号可以同时保持登录。
- **邮件登录进入正确的副本。** 邮件中的登录链接会在正在等待登录的副本中打开，而不是进入主 Claude。
- **同一个工作目录。** 可以用不同账号打开同一个项目文件夹。
- **共享设置和 MCP。** 每个副本启动时从主 Claude 获取 MCP 服务器和设置。可以关闭。
- **共享 Claude Code 历史。** 所有副本看到相同的 Code 会话。可以关闭。
- **桌面快捷方式。** 可以为每个账号创建。
- **中文界面。** 启动器跟随 Windows 语言，支持简体中文、英语和俄语。
- **主 Claude 保持原样。** 它照常工作，只有开启共享选项时才会读取或共享它的数据。

## 与类似工具的区别

Windows 上还有其他免费工具解决了这个问题的一部分。下表只列出各项目 README 在 2026 年 11 月 5 日的说明，最新情况请查看链接。如有错误，欢迎[提交 issue](https://github.com/Markwork51020/claude-desktop-multi-account/issues)。

| | 同时打开多个账号 | 邮件或浏览器登录进入正确的窗口 | 共享 MCP、设置和 Code 历史 | 界面 |
| --- | --- | --- | --- | --- |
| **Claude Multi** | 是 | 是，默认开启 | 是，每项都可关闭 | 窗口应用 |
| [Claude Profile Switcher](https://github.com/PriyanshuGeTRekT/Claude-Code-Desktop-Switcher) | 是 | 是，可选 | 可在账号之间转移 Code 对话 | 窗口应用（PowerShell） |
| [claude-desktop-multi](https://github.com/sypnose-cloud/claude-desktop-multi) | 是 | 否：登录新副本时需关闭其他窗口 | 否，各副本独立 | 脚本和快捷方式 |
| [Claude / Codex Multi-Instance](https://github.com/Zoltak-Dev/ai-multi-instance) | 是，也支持 Codex | 是，通过临时替换主 Claude 的数据 | 否，各配置文件独立 | 终端菜单（Python） |
| [Claude Account Switcher](https://github.com/SnlperStripes/claude-account-switcher) | 否：在账号之间切换同一个 Claude | 不需要：为每个账号保存登录状态 | 可带上 Code 对话 | 托盘应用，Windows 和 macOS |

**简而言之：** 如果您想同时打开多个账号，并让它们在同一个项目中使用相同的 MCP 服务器，Claude Multi 更合适。如果您希望各账号完全隔离，其他工具可能更适合。

## 安全与隐私

Claude Multi 是一个小型启动器，下面每一条都可以在源码中核实：[main.js](https://github.com/Markwork51020/claude-desktop-multi-account/blob/main/main.js)、[lib.js](https://github.com/Markwork51020/claude-desktop-multi-account/blob/main/lib.js)、[preload.js](https://github.com/Markwork51020/claude-desktop-multi-account/blob/main/preload.js)。

- **没有网络代码。** 启动器自身不发起任何连接：没有遥测、没有更新检查、没有服务器。
- **不碰您的登录信息。** 它不会读取、复制或转移 Cookie、令牌或密码。每个 Claude 副本自行登录，登录信息保存在各自的文件夹中。
- **不修改 Claude Desktop。** 不打补丁、不注入代码、不使用代理。它只启动 Microsoft Store 中的官方应用。
- **不需要管理员权限。** 只在当前用户的注册表（`HKCU`）中写入，用于接收 `claude://` 链接。所有键都列在[卸载](#卸载)中。
- **运行时没有第三方包。** 只使用 Electron 和 Node.js 内置模块。
- **这不是沙盒。** 各副本与 Claude 本身一样，以您的 Windows 用户权限运行。开启共享设置后，MCP 配置（包括其中的密钥）会被复制到您电脑上的每个配置文件中。

## 安装

**系统要求：** Windows 10 或 11，以及 Microsoft Store 版 [Claude Desktop](https://claude.ai/download)。

在 PowerShell 中运行：

```powershell
curl.exe -L -o "$env:TEMP\ClaudeMulti.zip" https://github.com/Markwork51020/claude-desktop-multi-account/releases/latest/download/ClaudeMulti-win32-x64.zip
```

```powershell
Expand-Archive "$env:TEMP\ClaudeMulti.zip" "$env:LOCALAPPDATA\Programs" -Force
```

```powershell
Start-Process "$env:LOCALAPPDATA\Programs\ClaudeMulti-win32-x64\ClaudeMulti.exe"
```

也可以从 [Releases](https://github.com/Markwork51020/claude-desktop-multi-account/releases/latest) 下载 zip，解压后运行 `ClaudeMulti.exe`。

该版本没有代码签名，Windows SmartScreen 可能会发出警告：请选择**更多信息 → 仍要运行**，或者[从源码构建](#从源码构建)。每个版本都列出了 zip 的 SHA-256。

## 添加账号

1. 点击 **+ 添加账号** 并输入名称。会打开一个未登录的独立 Claude 窗口。
2. 使用邮箱登录，并打开邮件中的链接。
3. 第一次打开时，Windows 会询问用哪个应用打开链接。请选择 **Claude Multi** 并勾选**始终使用此应用**。

链接会进入最近打开且仍在等待登录的副本。要重新登录已有副本，请先选择 **⋯ → 重新登录**。

## 常见问题

### Claude Desktop 可以同时登录两个账号吗？

应用本身不行。它一次只能登录一个账号，切换账号通常需要先退出。Claude Multi 的做法是为每个账号启动一个独立的官方应用副本。

### 如何在 Windows 上多开或双开 Claude Desktop？

为每个实例指定不同的 `--user-data-dir`：

```powershell
& "$env:LOCALAPPDATA\Microsoft\WindowsApps\claude-desktop.exe" --user-data-dir="$env:USERPROFILE\.claude-work"
```

Claude Multi 在内部也是这样做的。只用快捷方式就能打开第二个窗口，但会遇到下面的登录问题。

### 为什么 Claude 邮件登录链接打开了错误的账号？

该链接使用 `claude://` 协议，Windows 会把它交给主 Claude，所以第二个实例收不到。Claude Multi 注册为这类链接的处理程序，并把每个链接交给正在等待登录的副本。

### 用快捷方式还是 Claude Multi？

| | 带 `--user-data-dir` 的快捷方式 | Claude Multi |
| --- | --- | --- |
| 拥有独立数据的第二个窗口 | 是 | 是 |
| 邮件链接在正确的窗口打开 | 否 | 是 |
| 账号列表 | 否 | 是 |
| 共享 MCP 和设置 | 手动 | 内置，可关闭 |
| 共享 Claude Code 历史 | 手动 | 内置，可关闭 |

### 每个副本都能使用 Claude Code 吗？

可以。每个副本都是完整的桌面应用，其 Code 标签页使用该副本的账号运行。所有副本可以在同一个文件夹中工作。

### 这是沙盒吗？

不是。每个副本都是同一个应用，只是使用另一个数据文件夹。副本之间的登录信息和应用数据是分开的，但它们都以您的 Windows 用户权限运行，可以访问相同的文件。不要把它当作安全隔离手段。

### 支持 Microsoft Store 版吗？

支持，目前也只支持这个版本。数据保存在 `%USERPROFILE%\.claude-multi`，以避开 Store 应用虚拟化的 AppData 文件夹。

### 界面是什么语言？

启动器跟随 Windows 语言：简体中文、英语或俄语，其他语言显示英语。Claude Desktop 本身的语言不受影响。

### 它能让我在不支持的地区使用 Claude 吗？

不能。它不提供账号、网络连接或 Claude 的访问权限，也不能绕过地区限制。请查看 Anthropic 的[支持地区列表](https://www.anthropic.com/supported-countries)。

### 它会修改 Claude Desktop 或上传我的数据吗？

不会。详见[工作原理](#工作原理)。

### 这样做被允许吗？

这取决于您的套餐和使用方式。Anthropic 的条款适用于每个账号，本项目无法替您判断。请阅读条款，尤其是当您打算用额外账号规避用量限制时。

## 工作原理

Claude Multi 为每个账号启动官方应用，并指定单独的 `--user-data-dir`，因此每个副本都有自己的登录信息和数据。它不会修补或修改 Claude Desktop，也没有自己的服务器。登录链接会直接交给副本，不会被保存或写入日志。开启共享设置后，MCP 配置（包括其中的密钥）会被复制到您电脑上的每个配置文件中。

| 内容 | 位置 |
| --- | --- |
| 账号和配置文件 | `%USERPROFILE%\.claude-multi` |
| 链接处理程序（仅当前用户） | `HKCU\Software\Classes\ClaudeMulti.Link`、`HKCU\Software\ClaudeMulti` |
| 应用注册（仅当前用户） | `HKCU\Software\RegisteredApplications` 中的 `Claude Multi` 值 |

共享历史通过目录联接（junction）实现：每个副本的会话文件夹都指向主文件夹。

## 限制

- **早期版本。** 目前只在一台电脑上测试过：Windows 10 和 Microsoft Store 版。如果链接进入了错误的窗口，请[提交 issue](https://github.com/Markwork51020/claude-desktop-multi-account/issues)。
- **仅支持 Windows**，目前也仅支持 Microsoft Store 版 Claude Desktop。
- **不要在两个副本中同时打开同一个 Code 会话。** 它们会写入相同的文件。
- **连接器登录。** 从副本发起的 MCP 连接器 OAuth 回调会进入主 Claude。
- **Google 和 SSO 登录。** 这类链接的转发方式相同，但尚未测试。
- **Cowork。** 其他使用 `--user-data-dir` 方案的用户反映，同一时间只有一个配置文件可以运行 Cowork。这里尚未测试。
- **Claude Desktop 更新可能导致失效。** 启动器依赖应用当前的行为，而不是受支持的 API。

## 卸载

1. 删除应用文件夹。如果还要删除各副本的登录信息和数据，请删除 `%USERPROFILE%\.claude-multi`。
2. 删除注册表项：

```bash
reg delete "HKCU\Software\Classes\ClaudeMulti.Link" /f
```

```bash
reg delete "HKCU\Software\ClaudeMulti" /f
```

```bash
reg delete "HKCU\Software\RegisteredApplications" /v "Claude Multi" /f
```

## 从源码构建

```bash
npm install
```

```bash
npm run build
```

结果位于 `dist\ClaudeMulti-win32-x64`。链接转发只在打包后的版本中有效，`npm start` 下无效。

## 许可证

[MIT](LICENSE)
