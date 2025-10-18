import express, { type Request, type Response } from "express";
import cors from "cors";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { marinadeFinanceConfig } from "./config.js";
import { marinadeFinanceTools } from "./tools.js";
import { McpLogger } from "./logger.js";

async function createMarinadeFinanceServer() {
    const server = new McpServer(
        {
            name: marinadeFinanceConfig.mcpServer.name,
            version: marinadeFinanceConfig.mcpServer.version,
        },
        {
            capabilities: {
                tools: {},
            },
        },
    );

    for (const t of marinadeFinanceTools) {
        server.registerTool(
            t.name,
            {
                title: t.name,
                description: t.description,
                inputSchema: t.inputSchema
            },
            async (args) => {
                const result = await t.callback(args);
                return {
                    content: result.content.map(item => ({
                        ...item,
                        type: "text" as const
                    }))
                };
            }
        );
    }


    return server;
}

export async function start() {
    const useStreamHttp = process.env.USE_STREAMABLE_HTTP === "true";
    const useStdIO = !useStreamHttp;
    const port = Number(process.env.PORT || 3000);
    const host = process.env.HOST || "0.0.0.0";
    const server = await createMarinadeFinanceServer();

    if (useStdIO) {
        const transport = new StdioServerTransport();
        await server.connect(transport);
        McpLogger.info("Marinade Finance MCP Server running on stdio");
        McpLogger.info(`Mode: ${process.env.ENVIRONMENT === "MAINNET" ? "Mainnet" : "Testnet"}`);
        return;
    }

    const app = express();
    app.use(express.json());

    app.use(
        cors({
            origin: "*",
            allowedHeaders: ["Content-Type", "mcp-session-id"],
        })
    );

    app.post("/mcp", async (req: Request, res: Response) => {
        try {
            const transport: StreamableHTTPServerTransport = new StreamableHTTPServerTransport({
                enableDnsRebindingProtection: true,
                sessionIdGenerator: undefined,
            });

            res.on('close', () => {
                McpLogger.info('Request closed');
                transport.close();
                server.close();
            });

            await server.connect(transport);
            await transport.handleRequest(req, res, req.body);
        } catch (error) {
            McpLogger.error('Error handling MCP request:', String(error));
            if (!res.headersSent) {
                res.status(500).json({
                    jsonrpc: '2.0',
                    error: {
                        code: -32603,
                        message: 'Internal server error',
                    },
                    id: null,
                });
            }
        }
    });

    app.get('/mcp', async (req: Request, res: Response) => {
        McpLogger.info('Received GET MCP request');
        res.writeHead(405).end(JSON.stringify({
            jsonrpc: "2.0",
            error: {
                code: -32000,
                message: "Method not allowed."
            },
            id: null
        }));
    });

    app.delete('/mcp', async (req: Request, res: Response) => {
        McpLogger.info('Received DELETE MCP request');
        res.writeHead(405).end(JSON.stringify({
            jsonrpc: "2.0",
            error: {
                code: -32000,
                message: "Method not allowed."
            },
            id: null
        }));
    });

    app.get("/health", (_req, res) => res.status(200).send("ok"));

    app.listen(port, host, () => {
        McpLogger.info(`MCP Stateless Streamable HTTP listening on http://${host}:${port}`);
        McpLogger.info(`Mode: ${process.env.ENVIRONMENT === "MAINNET" ? "Mainnet" : "Testnet"}`);
    });
}