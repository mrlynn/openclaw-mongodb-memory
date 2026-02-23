# OpenClaw Plugin Development Guide

Complete guide for creating, packaging, and distributing OpenClaw plugins.

---

## 🎯 What is an OpenClaw Plugin?

An OpenClaw plugin is a **TypeScript/JavaScript module** that extends OpenClaw with:

- **Agent tools** - Functions the AI can call (e.g., `memory_search`, `voice_call`)
- **Gateway RPC methods** - Backend APIs (e.g., `memory.status`, `memory.recall`)
- **CLI commands** - New CLI subcommands (e.g., `openclaw voicecall`)
- **Messaging channels** - New chat surfaces (e.g., Matrix, Teams)
- **Background services** - Long-running processes (e.g., daemon management)
- **Auto-reply commands** - Slash commands that bypass the AI (e.g., `/status`)
- **Skills** - Documentation and workflow guides

Plugins run **in-process** with the Gateway (treat as trusted code).

---

## 📐 Plugin Structure

### Minimal Plugin

```
my-plugin/
├── openclaw.plugin.json    # Plugin manifest (REQUIRED)
├── index.ts                # Plugin entry point
├── package.json            # NPM metadata (if publishing)
└── README.md               # Documentation
```

### Full Plugin Structure

```
my-plugin/
├── openclaw.plugin.json    # Manifest
├── index.ts                # Entry point
├── src/
│   ├── tools/             # Agent tool implementations
│   ├── commands/          # CLI command handlers
│   └── services/          # Background services
├── skills/                # Bundled skills (optional)
│   └── my-skill/
│       └── SKILL.md
├── hooks/                 # Event-driven automation (optional)
│   └── my-hook/
│       ├── HOOK.md
│       └── handler.ts
├── dist/                  # Compiled output (if using TypeScript)
├── package.json           # NPM package metadata
├── tsconfig.json          # TypeScript config
└── README.md              # User documentation
```

---

## 📝 Plugin Manifest (openclaw.plugin.json)

**Required file** at plugin root. OpenClaw uses this for validation **without executing plugin code**.

### Minimal Example

```json
{
  "id": "my-plugin",
  "configSchema": {
    "type": "object",
    "additionalProperties": false,
    "properties": {}
  }
}
```

### Full Example

```json
{
  "id": "openclaw-memory",
  "name": "OpenClaw Memory",
  "version": "1.0.0",
  "kind": "memory",
  "description": "MongoDB-backed long-term memory with Voyage AI embeddings",
  "author": "Michael Lynn",
  "slots": ["memory"],
  "provides": {
    "tools": ["memory_search", "memory_get"],
    "gateway": ["memory.status", "memory.remember", "memory.recall"]
  },
  "configSchema": {
    "type": "object",
    "properties": {
      "daemonUrl": {
        "type": "string",
        "default": "http://localhost:7654",
        "description": "Memory daemon HTTP endpoint"
      },
      "agentId": {
        "type": "string",
        "default": "openclaw",
        "description": "Agent ID for memory storage"
      },
      "defaultTtl": {
        "type": "number",
        "default": 2592000,
        "description": "Default TTL in seconds (30 days)"
      }
    }
  },
  "uiHints": {
    "daemonUrl": {
      "label": "Daemon URL",
      "placeholder": "http://localhost:7654"
    },
    "agentId": {
      "label": "Agent ID",
      "placeholder": "openclaw"
    }
  }
}
```

### Manifest Fields

| Field          | Type   | Required | Description                            |
| -------------- | ------ | -------- | -------------------------------------- |
| `id`           | string | ✅       | Canonical plugin ID (kebab-case)       |
| `configSchema` | object | ✅       | JSON Schema for plugin config          |
| `name`         | string | ❌       | Display name                           |
| `version`      | string | ❌       | Plugin version (semver)                |
| `description`  | string | ❌       | Short summary                          |
| `author`       | string | ❌       | Plugin author                          |
| `kind`         | string | ❌       | Plugin category (e.g., `"memory"`)     |
| `slots`        | array  | ❌       | Exclusive plugin slots                 |
| `channels`     | array  | ❌       | Channel IDs registered by plugin       |
| `providers`    | array  | ❌       | Provider IDs registered by plugin      |
| `skills`       | array  | ❌       | Skill directories (relative paths)     |
| `provides`     | object | ❌       | Tools/gateway methods provided         |
| `uiHints`      | object | ❌       | UI labels/placeholders/sensitive flags |

---

## 🔧 Plugin Entry Point (index.ts)

### Function Export

```typescript
import type { PluginAPI } from "openclaw/plugin-sdk";

export default function (api: PluginAPI) {
  api.logger.info("My plugin loaded!");

  // Register tools, RPC methods, CLI commands, etc.
}
```

### Object Export

```typescript
export default {
  id: "my-plugin",
  name: "My Plugin",
  register(api: PluginAPI) {
    api.logger.info("My plugin loaded!");
  },
};
```

---

## 🛠️ Registering Agent Tools

Agent tools are functions the AI can call during conversations.

### Basic Tool

```typescript
import { Type } from "@sinclair/typebox";

export default function (api) {
  api.registerTool({
    name: "my_tool",
    description: "Do a thing",
    parameters: Type.Object({
      input: Type.String({ description: "Input text" }),
    }),
    async execute(_id, params) {
      // Your tool logic here
      const result = await doSomething(params.input);

      return {
        content: [{ type: "text", text: result }],
      };
    },
  });
}
```

### Optional Tool (Opt-In)

Optional tools require explicit allowlisting:

```typescript
api.registerTool(
  {
    name: "dangerous_tool",
    description: "Runs system commands",
    parameters: Type.Object({
      command: Type.String(),
    }),
    async execute(_id, params) {
      // Only runs if user enables this tool
      return { content: [{ type: "text", text: "Done" }] };
    },
  },
  { optional: true },
);
```

**Enable in config:**

```json5
{
  agents: {
    list: [
      {
        id: "main",
        tools: {
          allow: ["dangerous_tool"],
        },
      },
    ],
  },
}
```

---

## 🌐 Registering Gateway RPC Methods

Gateway RPC methods are backend APIs accessible via HTTP or internal calls.

```typescript
export default function (api) {
  api.registerGatewayMethod("myplugin.status", ({ respond }) => {
    respond(true, { ok: true, uptime: process.uptime() });
  });

  api.registerGatewayMethod("myplugin.action", async ({ params, respond }) => {
    try {
      const result = await doWork(params);
      respond(true, result);
    } catch (err) {
      respond(false, { error: err.message });
    }
  });
}
```

**Access via:**

- HTTP: `POST http://localhost:18789/rpc` with `{"method": "myplugin.status", "params": {}}`
- Internal: `api.runtime.gateway.call("myplugin.status", {})`

---

## 💻 Registering CLI Commands

Add new subcommands to the `openclaw` CLI.

```typescript
export default function (api) {
  api.registerCli(
    ({ program }) => {
      program
        .command("mycmd")
        .description("Do something cool")
        .option("-v, --verbose", "Verbose output")
        .action((options) => {
          console.log("Hello from mycmd!");
          if (options.verbose) {
            console.log("Verbose mode enabled");
          }
        });
    },
    { commands: ["mycmd"] },
  );
}
```

**Usage:**

```bash
openclaw mycmd --verbose
```

---

## 🤖 Registering Auto-Reply Commands

Auto-reply commands execute **without** invoking the AI agent (instant responses).

```typescript
export default function (api) {
  api.registerCommand({
    name: "status",
    description: "Show plugin status",
    handler: (ctx) => ({
      text: `Plugin status: OK\nChannel: ${ctx.channel}\nUser: ${ctx.senderId}`,
    }),
  });

  api.registerCommand({
    name: "toggle",
    description: "Toggle a feature",
    acceptsArgs: true,
    requireAuth: true,
    handler: async (ctx) => {
      const mode = ctx.args?.trim() || "default";
      await setMode(mode);
      return { text: `Mode set to: ${mode}` };
    },
  });
}
```

**Usage in chat:**

```
/status
/toggle production
```

---

## 🔌 Registering Messaging Channels

Add new chat surfaces (like Telegram, WhatsApp, Matrix).

```typescript
const myChannel = {
  id: "acmechat",
  meta: {
    id: "acmechat",
    label: "AcmeChat",
    selectionLabel: "AcmeChat (API)",
    docsPath: "/channels/acmechat",
    blurb: "Demo channel plugin",
    aliases: ["acme"],
  },
  capabilities: {
    chatTypes: ["direct", "group"],
  },
  config: {
    listAccountIds: (cfg) => Object.keys(cfg.channels?.acmechat?.accounts ?? {}),
    resolveAccount: (cfg, accountId) => cfg.channels?.acmechat?.accounts?.[accountId ?? "default"],
  },
  outbound: {
    deliveryMode: "direct",
    sendText: async ({ text, target }) => {
      // Send message via your API
      await yourApi.sendMessage(target, text);
      return { ok: true };
    },
  },
};

export default function (api) {
  api.registerChannel({ plugin: myChannel });
}
```

**Config:**

```json5
{
  channels: {
    acmechat: {
      accounts: {
        default: {
          token: "YOUR_API_TOKEN",
          enabled: true,
        },
      },
    },
  },
}
```

---

## 🚀 Registering Background Services

Long-running processes managed by the Gateway.

```typescript
export default function (api) {
  let intervalId;

  api.registerService({
    id: "my-service",
    start: () => {
      api.logger.info("Starting background service...");
      intervalId = setInterval(() => {
        api.logger.info("Background task running");
      }, 60000);
    },
    stop: () => {
      api.logger.info("Stopping background service...");
      if (intervalId) clearInterval(intervalId);
    },
  });
}
```

---

## 📦 Packaging for NPM

### package.json

```json
{
  "name": "@openclaw/my-plugin",
  "version": "1.0.0",
  "description": "My OpenClaw plugin",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": ["dist", "openclaw.plugin.json", "README.md", "skills"],
  "openclaw": {
    "extensions": ["./dist/index.js"]
  },
  "scripts": {
    "build": "tsc",
    "prepublish": "npm run build"
  },
  "keywords": ["openclaw", "openclaw-plugin", "ai", "agent"],
  "author": "Your Name",
  "license": "MIT",
  "peerDependencies": {
    "openclaw": ">=2026.2.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0"
  }
}
```

### Publishing Checklist

- [ ] `openclaw.plugin.json` at root (with valid JSON Schema)
- [ ] `package.json` with `openclaw.extensions` pointing to built file
- [ ] Build output in `dist/` (if using TypeScript)
- [ ] README.md with installation and configuration docs
- [ ] Test locally: `openclaw plugins install ./my-plugin`
- [ ] Publish: `npm publish --access public`

### Publishing Commands

```bash
# Build
npm run build

# Test locally
openclaw plugins install .
openclaw plugins list

# Publish to npm
npm publish --access public

# Or use pnpm (auto-converts workspace:* refs)
pnpm publish --access public
```

---

## 📥 Installation Methods

### From NPM

```bash
openclaw plugins install @openclaw/my-plugin
```

### From Local Path

```bash
# Copy to ~/.openclaw/extensions/my-plugin
openclaw plugins install ./my-plugin

# Symlink (for development)
openclaw plugins install -l ./my-plugin
```

### From Archive

```bash
openclaw plugins install ./my-plugin.tgz
openclaw plugins install ./my-plugin.zip
```

### From GitHub (via npm)

```bash
npm install -g @openclaw/my-plugin
# Then restart OpenClaw gateway
```

---

## ⚙️ Plugin Configuration

### User Config Location

```
~/.openclaw/openclaw.json
```

### Config Structure

```json5
{
  plugins: {
    enabled: true,
    allow: ["my-plugin"], // Allowlist (optional)
    entries: {
      "my-plugin": {
        enabled: true,
        config: {
          // Your plugin's config (validated by configSchema)
          apiKey: "secret",
          region: "us-east-1",
        },
      },
    },
  },
}
```

### CLI Config Management

```bash
# Enable plugin
openclaw plugins enable my-plugin

# Disable plugin
openclaw plugins disable my-plugin

# View plugin info
openclaw plugins info my-plugin

# List all plugins
openclaw plugins list

# Check for issues
openclaw plugins doctor
```

---

## 🧪 Testing

### Local Development

```bash
# Link plugin for development
cd ~/my-plugin
openclaw plugins install -l .

# Restart gateway
openclaw gateway restart

# Test CLI command
openclaw my-command

# Test tool
# (Use agent chat to trigger tool)
```

### Unit Tests

```typescript
// src/my-plugin.test.ts
import { describe, it, expect } from "vitest";
import plugin from "./index";

describe("my-plugin", () => {
  it("should register tools", () => {
    const mockApi = {
      registerTool: vi.fn(),
      logger: { info: vi.fn() },
    };

    plugin(mockApi);

    expect(mockApi.registerTool).toHaveBeenCalled();
  });
});
```

---

## 🔒 Security Best Practices

1. **Validate all inputs** - Use TypeBox/Zod for parameter validation
2. **Use configSchema** - Validate config at load time (before execution)
3. **Mark sensitive fields** - Use `uiHints` to mark API keys as `sensitive: true`
4. **Avoid world-writable paths** - OpenClaw blocks plugins in world-writable dirs
5. **Use optional: true** - For tools with side effects or external deps
6. **Document permissions** - Explain what the plugin can access
7. **No lifecycle scripts** - OpenClaw installs with `--ignore-scripts` (security)

---

## 📚 Real-World Example: openclaw-memory

**Structure:**

```
openclaw-memory/
├── openclaw.plugin.json    # Manifest with kind: "memory"
├── plugin/
│   └── index.ts           # Plugin entry (tools + RPC)
├── packages/
│   ├── daemon/            # Memory daemon (separate process)
│   ├── client/            # Client SDK
│   └── cli/               # CLI tools
├── skills/
│   └── openclaw-memory/
│       └── SKILL.md
└── docs/                  # User documentation
```

**Key Features:**

- **Agent tools**: `memory_search`, `memory_get`
- **Gateway RPC**: `memory.status`, `memory.remember`, `memory.recall`, `memory.forget`
- **Background service**: Auto-starts memory daemon
- **CLI commands**: `ocmem status`, `ocmem export`, etc.
- **Config schema**: Daemon URL, agent ID, TTL, auto-start flag

**Full source:** https://github.com/mrlynn/openclaw-mongodb-memory

---

## 🚀 Next Steps

1. **Study existing plugins**: Voice Call, Matrix, Teams
2. **Read OpenClaw docs**: https://docs.openclaw.ai/tools/plugin
3. **Join community**: Discord/GitHub discussions
4. **Publish to npm**: Use `@openclaw/*` namespace (request access)
5. **Submit to catalog**: Add to Community Plugins list

---

## 📞 Support

- **OpenClaw Docs**: https://docs.openclaw.ai
- **Plugin API Docs**: https://docs.openclaw.ai/tools/plugin
- **Community Plugins**: https://docs.openclaw.ai/plugins/community
- **GitHub**: https://github.com/openclaw/openclaw
- **Discord**: https://discord.com/invite/clawd

---

## 🎯 Plugin Checklist

### Before Publishing

- [ ] `openclaw.plugin.json` with valid JSON Schema
- [ ] `package.json` with `openclaw.extensions`
- [ ] README.md with install/config instructions
- [ ] Built output in `dist/` (if TypeScript)
- [ ] Tests passing
- [ ] Local install test successful
- [ ] Documentation complete
- [ ] Security review done
- [ ] License specified (MIT recommended)

### After Publishing

- [ ] Test npm install: `npm install -g @your-scope/your-plugin`
- [ ] Verify in fresh OpenClaw instance
- [ ] Submit to Community Plugins list
- [ ] Announce on Discord/Twitter
- [ ] Monitor GitHub issues

---

**Happy plugin building!** 🎉
