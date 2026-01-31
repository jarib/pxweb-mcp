# pxweb-mcp

MCP server for accessing statistical data via the PxWeb API v2.

## Quick Start

```bash
pnpm install
pnpm build
node build/index.js
```

Server runs at `http://localhost:3000/mcp` using Statistics Norway (SSB) by default.

## Known PxWeb v2 Instances

| Organization | URL |
|--------------|-----|
| Statistics Norway (SSB) | `https://data.ssb.no/api/pxwebapi/v2` |
| Statistics Sweden (SCB) | `https://statistikdatabasen.scb.se/api/v2` |

Use the `--url` option to connect to a different instance:

```bash
node build/index.js --url https://statistikdatabasen.scb.se/api/v2
```

## Configuration

### Claude Code

Add to `~/.claude/settings.json`:

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

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

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

## Example Workflow

```
1. Search for population tables
   → search_tables({ query: "befolkning*" })

2. Get table info
   → get_table_info({ table_id: "07459" })

3. Fetch full metadata to see variables
   → fetch_metadata({ table_id: "07459" })

4. Query data for Oslo, last 5 years
   → query_table({
       table_id: "07459",
       value_codes: {
         Region: "0301",
         Tid: "top(5)",
         ContentsCode: "*"
       }
     })
```

## Tools

All tools default to Norwegian. Pass `language: "en"` for English.

| Tool | Description |
|------|-------------|
| `search_tables` | Search for tables by keyword |
| `get_table_info` | Quick table overview |
| `fetch_metadata` | Detailed structure for building queries |
| `query_table` | Fetch data from a table |
| `get_code_list` | Get valuesets or groupings |
| `list_recent_tables` | Find recently updated tables |

### search_tables

Search for tables in the database.

| Parameter | Type | Description |
|-----------|------|-------------|
| `query` | string | Search query (wildcards: `*`, boolean: `AND`/`OR`) |
| `language` | `"no"` \| `"en"` | Default: `"no"` |
| `include_discontinued` | boolean | Include discontinued series. Default: `false` |

**Query examples:**
- `befolkning*` - wildcard search
- `title:children AND title:(K)` - title + municipality filter
- `updated:20250908*` - tables updated on date

### get_table_info

Get basic table info (title, time range, variables).

| Parameter | Type | Description |
|-----------|------|-------------|
| `table_id` | string | Table ID (e.g. `"07459"`) |
| `language` | `"no"` \| `"en"` | Default: `"no"` |

### fetch_metadata

Fetch detailed metadata for constructing queries.

| Parameter | Type | Description |
|-----------|------|-------------|
| `table_id` | string | Table ID |
| `language` | `"no"` \| `"en"` | Default: `"no"` |

### query_table

Query data from a table.

| Parameter | Type | Description |
|-----------|------|-------------|
| `table_id` | string | Table ID |
| `value_codes` | object | Variable selections (see syntax below) |
| `language` | `"no"` \| `"en"` | Default: `"no"` |
| `output_format` | string | `"json-stat2"`, `"csv"`, `"xlsx"`, `"html"`, `"px"`, `"json-px"` |
| `code_list` | object | Code lists for aggregation |
| `output_values` | object | `"aggregated"` or `"single"` per variable |

**Value selection syntax:**
| Syntax | Example | Description |
|--------|---------|-------------|
| Specific | `"0301,0402"` | Select specific values |
| All | `"*"` | Select all values |
| Wildcard | `"??"` | Pattern match (two digits) |
| Top N | `"top(5)"` | Latest N values |
| From | `"from(2020M01)"` | All from start value |
| Range | `"[range(01,05)]"` | Values in range |

### get_code_list

Fetch a code list (valueset or grouping).

| Parameter | Type | Description |
|-----------|------|-------------|
| `code_list_id` | string | e.g. `"vs_Fylker"`, `"agg_KommSummer"` |
| `language` | `"no"` \| `"en"` | Default: `"no"` |

### list_recent_tables

List tables updated in the past N days.

| Parameter | Type | Description |
|-----------|------|-------------|
| `days` | number | Days to look back (1-365) |
| `language` | `"no"` \| `"en"` | Default: `"no"` |

## Server Options

| Option | Default | Description |
|--------|---------|-------------|
| `--url` | `https://data.ssb.no/api/pxwebapi/v2` | PxWeb API base URL |
| `--port` | `3000` | HTTP server port |

**Endpoints:**
- `/mcp` - MCP protocol endpoint
- `/health` - Health check (returns `{"status":"ok"}`)

## Links

- [PxWeb API v2 (GitHub)](https://github.com/PxTools/PxWebApi)
- [SSB API Documentation](https://www.ssb.no/en/api/pxwebapiv2)
- [SCB API Documentation](https://www.scb.se/en/services/open-data-api/pxwebapi/)
- [MCP Protocol](https://modelcontextprotocol.io)

## License

MIT
