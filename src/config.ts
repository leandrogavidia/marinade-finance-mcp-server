const MCP_CLIENT_NAME = "marinade-finance-docs-client"
const MCP_CLIENT_VERSION = "1.0.0"

const MARINADE_FINANCE_DOCS_URL = "https://docs.marinade.finance"

const MCP_SERVER_NAME = "marinade-finance-mcp-server"
const MCP_SERVER_VERSION = "1.0.0"

export const marinadeFinanceConfig = {
    mcpClient: {
        name: MCP_CLIENT_NAME,
        version: MCP_CLIENT_VERSION,
        marinadeFinanceDocsUrl: MARINADE_FINANCE_DOCS_URL
    },
    mcpServer: {
        name: MCP_SERVER_NAME,
        version: MCP_SERVER_VERSION
    }
}