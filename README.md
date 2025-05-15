# y-server 🚀

A Cloudflare Worker-based MCP (Model Context Protocol) Server with streamable HTTP transport support. This server provides various tools and integrations for AI assistants to interact with external services and APIs.

This server is designed to work with [y-gui](https://github.com/luohy15/y-gui), a web-based graphical interface for AI chat interactions with powerful MCP integrations.

## Overview

y-server is designed to extend AI capabilities through the Model Context Protocol by providing a suite of tools that allow AI assistants to:

- Manage calendar events (Google Calendar)
- Handle emails (Gmail)
- Fetch and scrape web content
- Generate and manipulate images
- Search the web (Brave Search, Tavily)
- Edit and manage files (S3 storage)

## Features

### Calendar Tools
- Create, read, update, and delete Google Calendar events

### Email Tools
- Query, read, and reply to emails via Gmail
- Create and manage email drafts
- Handle email attachments

### Fetch & Scrape Tools
- Cloudflare-powered web fetching
- Firecrawl web scraping capabilities

### Image Tools
- Image generation and routing

### Search Tools
- Brave local and web search
- Tavily search and information extraction

### Editor Tools
- S3-based file operations (read, write, replace)

## Installation

### Prerequisites
- Node.js (latest LTS version recommended)
- Cloudflare account with Workers and R2 access

### Setup
1. Clone the repository
```bash
git clone https://github.com/yourusername/y-server.git
cd y-server
```

2. Install dependencies
```bash
npm install
```

3. Configure your environment variables in the Cloudflare dashboard or using `.dev.vars` for local development

## Configuration

### Cloudflare Worker Configuration
The project uses `wrangler.toml` for Cloudflare Worker configuration:

```toml
name = "y-server"
main = "src/index.ts"
compatibility_flags = [ "nodejs_compat" ]
compatibility_date = "2024-09-23"

[[r2_buckets]]
binding = "CDN_BUCKET"
bucket_name = "cdn-yovy-app"

[dev]
port = 8788
ip = "localhost"
local_protocol = "http"
```

### Required Environment Variables
- `CLOUDFLARE_ACCOUNT_ID`: Your Cloudflare account ID
- `CLOUDFLARE_BROWSER_RENDER_API_TOKEN`: API token for Cloudflare Browser Rendering
- Other service-specific credentials (Google API, Brave API, etc.)

## Development

### Local Development
Start the development server:
```bash
npm run dev
```

This will start the worker on http://localhost:8788

### Build
Build the project:
```bash
npm run build
```

### Deploy
Deploy to Cloudflare Workers:
```bash
npm run deploy
```

## MCP Integration

This server implements the Model Context Protocol, allowing AI assistants to use the provided tools through a standardized interface. It uses a streamable HTTP transport that enables efficient communication with AI models.

### Integration with y-gui

y-server is designed to work as an MCP server for [y-gui](https://github.com/luohy15/y-gui), a web-based graphical interface for AI chat interactions. The y-gui client provides:

- 💬 Interactive chat interface with AI models
- 🤖 Support for multiple bot configurations
- 🔗 Comprehensive MCP integration system
- 🔒 Secure authentication with Auth0 and Google login
- 🌓 Dark/light theme support
- 📝 All chat data stored in Cloudflare R2

To connect y-server with y-gui:

1. Deploy your y-server instance
2. In y-gui, configure a new MCP server with your y-server URL
3. Enable the desired tools in your bot configuration

For more information, visit the [y-gui repository](https://github.com/luohy15/y-gui).

There's also a CLI version available: [y-cli](https://github.com/luohy15/y-cli).

## Project Structure
```
src/
├── index.ts                 # Main entry point
├── tools/                   # All MCP tools
│   ├── calendar/            # Calendar tools (Google)
│   ├── editor/              # Editor tools (S3)
│   ├── email/               # Email tools (Gmail)
│   ├── fetch/               # Web fetch tools
│   ├── image/               # Image tools
│   └── search/              # Search tools (Brave, Tavily)
├── transport/               # HTTP transport implementation
└── types/                   # TypeScript type definitions
```

## License

[Add your license here]

## Contributing

[Add contribution guidelines here]
