#!/usr/bin/env node

import { createServer } from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

const DEFAULT_API_BASE = "https://data.ssb.no/api/pxwebapi/v2";
const DEFAULT_LANGUAGE = "no";
const USER_AGENT = "pxweb-mcp/1.0";
const DEFAULT_PORT = 3000;

interface Args {
  url: string;
  port: number;
}

const argv = yargs(hideBin(process.argv))
  .option("url", {
    type: "string",
    description: "PxWeb API base URL",
    default: DEFAULT_API_BASE,
  })
  .option("port", {
    type: "number",
    description: "Port to listen on",
    default: DEFAULT_PORT,
  })
  .help()
  .parseSync() as Args;

const languageSchema = z
  .enum(["en", "no"])
  .default(DEFAULT_LANGUAGE)
  .describe("Language - 'no' for Norwegian (default), 'en' for English.");

async function makeRequest(url: string): Promise<Response> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }

  return response;
}

function createMcpServer(apiBase: string): McpServer {
  const server = new McpServer({
    name: "pxweb-mcp",
    version: "1.0.0",
  });

  // Tool: search_tables
  server.registerTool(
    "search_tables",
    {
      description: `Search for tables in Statistics Norway (SSB) database.

Supports wildcards (*) at end of words, boolean operators (AND, OR), and special filters:
- title:word - search only in titles
- updated:20250908* - tables updated on date
- "word1 word2"~5 - proximity search (words within 5 words of each other)

Geographic indicators in titles: (F) = county, (K) = municipality, (B) = city district.`,
      inputSchema: {
        query: z
          .string()
          .describe("Search query. Examples: 'befolkning*', 'title:children AND title:(K)'"),
        language: languageSchema,
        include_discontinued: z
          .boolean()
          .default(false)
          .describe("Include discontinued table series."),
      },
    },
    async ({ query, language, include_discontinued }) => {
      const params = new URLSearchParams({
        lang: language,
        query: query.trim(),
        includeDiscontinued: String(include_discontinued),
      });

      const url = `${apiBase}/tables?${params}`;

      try {
        const response = await makeRequest(url);
        const data = await response.json();

        const tables = data.tables || [];
        if (tables.length === 0) {
          return {
            content: [{ type: "text", text: "No tables found for your query." }],
          };
        }

        const results = tables.map((t: { id: string; label: string }) => `${t.id}: ${t.label}`);

        return {
          content: [{ type: "text", text: results.join("\n") }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error searching tables: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    }
  );

  // Tool: get_table_info
  server.registerTool(
    "get_table_info",
    {
      description: `Get basic information about a table (title, time range, variables).

Use this for a quick overview before fetching full metadata.`,
      inputSchema: {
        table_id: z.string().describe("The table ID (e.g. '07459', '11342')."),
        language: languageSchema,
      },
    },
    async ({ table_id, language }) => {
      const url = `${apiBase}/tables/${table_id.trim()}?lang=${language}`;

      try {
        const response = await makeRequest(url);
        const text = await response.text();

        return {
          content: [{ type: "text", text }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error fetching table info: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    }
  );

  // Tool: fetch_metadata
  server.registerTool(
    "fetch_metadata",
    {
      description: `Fetch detailed metadata for a table to understand its structure.

Returns variable IDs, value codes, elimination info, and available code lists.
Use this to construct queries.`,
      inputSchema: {
        table_id: z.string().describe("The table ID (e.g. '07459', '11342')."),
        language: languageSchema,
      },
    },
    async ({ table_id, language }) => {
      const url = `${apiBase}/tables/${table_id.trim()}/metadata?lang=${language}`;

      try {
        const response = await makeRequest(url);
        const text = await response.text();

        return {
          content: [{ type: "text", text }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error fetching metadata: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    }
  );

  // Tool: query_table
  server.registerTool(
    "query_table",
    {
      description: `Query data from a table using the v2 API syntax.

Value selection syntax:
- Specific values: valueCodes[Region]=0301,0402
- All values: valueCodes[Region]=*
- Wildcard: valueCodes[Konsumgrp]=?? (two-digit codes)
- Latest N: valueCodes[Tid]=top(5)
- From value: valueCodes[Tid]=from(2020M01)
- Range: valueCodes[Region]=[range(01,05)]

Output formats: json-stat2, csv, xlsx, html, px, json-px

For csv/xlsx/html, use stub and heading to control layout.`,
      inputSchema: {
        table_id: z.string().describe("The table ID to query."),
        value_codes: z
          .record(z.string(), z.string())
          .describe(
            "Object mapping variable IDs to value selections. Example: { Region: '0301', Tid: 'top(5)', ContentsCode: '*' }"
          ),
        language: languageSchema,
        output_format: z
          .enum(["json-stat2", "csv", "xlsx", "html", "px", "json-px"])
          .default("json-stat2")
          .describe("Output format."),
        code_list: z
          .record(z.string(), z.string())
          .optional()
          .describe("Optional code lists to use. Example: { Region: 'agg_Fylker2024' }"),
        output_values: z
          .record(z.string(), z.enum(["aggregated", "single"]))
          .optional()
          .describe("For groupings: 'aggregated' for sums, 'single' for individual values."),
      },
    },
    async ({ table_id, value_codes, language, output_format, code_list, output_values }) => {
      const params = new URLSearchParams({ lang: language, outputFormat: output_format });

      for (const [key, value] of Object.entries(value_codes) as [string, string][]) {
        params.append(`valueCodes[${key}]`, value);
      }

      if (code_list) {
        for (const [key, value] of Object.entries(code_list) as [string, string][]) {
          params.append(`codelist[${key}]`, value);
        }
      }

      if (output_values) {
        for (const [key, value] of Object.entries(output_values) as [string, string][]) {
          params.append(`outputValues[${key}]`, value);
        }
      }

      const url = `${apiBase}/tables/${table_id.trim()}/data?${params}`;

      try {
        const response = await fetch(url, {
          headers: {
            "User-Agent": USER_AGENT,
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }

        const text = await response.text();

        return {
          content: [{ type: "text", text }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error querying table: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    }
  );

  // Tool: get_code_list
  server.registerTool(
    "get_code_list",
    {
      description: `Fetch a code list (valueset or grouping).

Valuesets (vs_*): Lists of valid values for a variable.
Groupings (agg_*): Aggregation mappings (e.g., municipality mergers).

Find available code lists in table metadata under 'codeLists'.`,
      inputSchema: {
        code_list_id: z
          .string()
          .describe("Code list ID (e.g. 'vs_Fylker', 'agg_KommSummer')."),
        language: languageSchema,
      },
    },
    async ({ code_list_id, language }) => {
      const url = `${apiBase}/codeLists/${code_list_id.trim()}?lang=${language}`;

      try {
        const response = await makeRequest(url);
        const text = await response.text();

        return {
          content: [{ type: "text", text }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error fetching code list: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    }
  );

  // Tool: list_recent_tables
  server.registerTool(
    "list_recent_tables",
    {
      description: `List tables updated in the past N days.

Use this to find newly published statistics.`,
      inputSchema: {
        days: z.number().int().min(1).max(365).describe("Number of days to look back."),
        language: languageSchema,
      },
    },
    async ({ days, language }) => {
      const params = new URLSearchParams({
        lang: language,
        pastdays: String(days),
      });

      const url = `${apiBase}/tables?${params}`;

      try {
        const response = await makeRequest(url);
        const data = await response.json();

        const tables = data.tables || [];
        if (tables.length === 0) {
          return {
            content: [{ type: "text", text: `No tables updated in the past ${days} days.` }],
          };
        }

        const results = tables.map(
          (t: { id: string; label: string; updated: string }) =>
            `${t.id}: ${t.label} (updated: ${t.updated})`
        );

        return {
          content: [{ type: "text", text: results.join("\n") }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error listing recent tables: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    }
  );

  return server;
}

async function main() {
  const { url, port } = argv;

  const mcpServer = createMcpServer(url);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
  });

  const httpServer = createServer(async (req, res) => {
    const pathname = req.url?.split("?")[0] || "/";

    // Health check endpoint
    if (pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
      return;
    }

    // MCP endpoint
    if (pathname === "/mcp") {
      try {
        await transport.handleRequest(req, res);
      } catch (error) {
        console.error("MCP error:", error);
        if (!res.headersSent) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Internal server error" }));
        }
      }
      return;
    }

    // Not found
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  });

  await mcpServer.connect(transport);

  httpServer.listen(port, () => {
    console.error(`PxWeb MCP Server running on http://localhost:${port}/mcp`);
    console.error(`Using API: ${url}`);
  });
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
