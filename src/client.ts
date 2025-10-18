import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { marinadeFinanceConfig } from "./config.js";
import { McpLogger } from "./logger.js";

async function createGitbookMcpClient(docsUrl: string) {
    try {
        let client: Client | undefined = undefined

        client = new Client(
            {
                name: marinadeFinanceConfig.mcpClient.name,
                version: marinadeFinanceConfig.mcpClient.version,
            },
            {
                capabilities: {}
            }
        );

        const mcpServerUrl = new URL(`${docsUrl}/~gitbook/mcp`);

        const transport = new StreamableHTTPClientTransport(mcpServerUrl) as Transport;

        await client.connect(transport);

        return {
            client,
            async listTools() {
                const resp = await client.listTools();
                return resp.tools ?? [];
            },
        };
    } catch (error) {
        McpLogger.error("Error connecting to GitBookClient:", String(error));
        throw error;
    }
}

export async function createMarinadeFinanceDocsMcpClient(): Promise<{
    client: Client;
    listTools(): Promise<any[]>;
}> {
    try {
        const marinadeFinanceDocsMcpClient = await createGitbookMcpClient(marinadeFinanceConfig.mcpClient.marinadeFinanceDocsUrl);
        return marinadeFinanceDocsMcpClient
    } catch (err) {
        McpLogger.error("Error creating Marinade Finance Docs MCP Client:", String(err));
        throw err;
    }
}