# pxweb-mcp

MCP server for accessing statistical data via the PxWeb API v2.

## Quick Start

```bash
npx -y @jarib/pxweb-mcp
npx -y @jarib/pxweb-mcp --transport http --port 3000
```



## Known PxWeb v2 Instances

| Organization | URL |
|--------------|-----|
| Statistics Norway (SSB) | `https://data.ssb.no/api/pxwebapi/v2` |
| Statistics Sweden (SCB) | `https://statistikdatabasen.scb.se/api/v2` |

Use the `--url` option to connect to a different instance:

```bash
npx @jarib/pxweb-mcp --url https://statistikdatabasen.scb.se/api/v2
```


## Development

```bash
pnpm install
pnpm build
node build/index.js
```



## Configuration


```json
{
  "mcpServers": {
    "pxweb": {
      "type": "http",
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

## Links

- [PxWeb API v2 (GitHub)](https://github.com/PxTools/PxWebApi)
- [SSB API Documentation](https://www.ssb.no/en/api/pxwebapiv2)
- [SCB API Documentation](https://www.scb.se/en/services/open-data-api/pxwebapi/)
- [MCP Protocol](https://modelcontextprotocol.io)

## License

MIT
