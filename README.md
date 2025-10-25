<div align="center">

<p></p>

<h1>Marinade Finance MCP Server</h1>
[![smithery badge](https://smithery.ai/badge/@leandrogavidia/marinade-finance-mcp-server)](https://smithery.ai/server/@leandrogavidia/marinade-finance-mcp-server)

<p>Marinade Finance MCP Server is an MCP server specifically designed for interacting with Marinade Finance on the Solana network. It provides advanced functionalities such as querying the official Marinade Finance documentation, retrieving protocol state information, managing liquid staking operations (stake/unstake), checking mSOL balances, and sending mSOL tokens between wallets.</p>

</div>

## Integration

Register the server in your MCP-aware host configuration.

```json
{
  "mcpServers": {
    "marinade-finance": {
      "url": "https://server.smithery.ai/@leandrogavidia/marinade-finance-mcp-server/mcp",
      "type": "streamable-http"
    }
  }
}
```

## Tools

- ### Marinade Finance Docs 

    - **Docs**
        
        - `search_documentation`: Search Marinade Finance Documentation for relevant information, code examples, API references, and guides.

- ### Marinade Finance State

    - **State**
        
        - `get_marinade_state`: Retrieve the current state of the Marinade Finance protocol, including information about staked assets, mint address, price, rewards, and other relevant data.

- ### Liquid Staking & Wallet Operations

    - **Balance**
        
        - `get_msol_balance`: Check the mSOL token balance of the environment wallet or any specified Solana wallet address.

    - **Staking**
        
        - `stake_msol`: Stake SOL tokens with Marinade Finance to receive mSOL tokens and earn rewards.
        
        - `unstake_msol`: Unstake mSOL tokens to receive SOL tokens back.
    
    - **Transfers**
        
        - `send_msol`: Send mSOL tokens to another Solana wallet address (automatically creates recipient token account if needed).

---

## .env Config

- `PRIVATE_KEY`: Base58-encoded private key for your Solana wallet (required for on-chain operations like staking, unstaking, and transfers).

- `SOLANA_RPC_URL`: Solana RPC URL for mainnet operations.

- `SOLANA_RPC_URL_DEVNET`: Solana RPC URL for devnet/testnet operations.

- `ENVIRONMENT`: Working environment, either `MAINNET` or `TESTNET`.

- `USE_STREAMABLE_HTTP`: Specifies whether your MCP server will run on stdio or streamable-http (set to `true` or `false`).

- `PORT`: Port where your MCP server will run when using streamable-http (default: 3000).

- `HOST`: Host where your MCP server will run when using streamable-http (default: 0.0.0.0).

## Run the project locally

In one terminal window, run the following command: `pnpx @modelcontextprotocol/inspector pnpx tsx ./src/index.ts` in `stdio` mode.

## Build and run

Run the command: `pnpm run build` and then: `pnpm run start`

## Deployment

To deploy this MCP server, fork this project into your GitHub account, log in to [smithery.ai](https://smithery.ai/), and click Publish server. Complete the steps, and once it is deployed, add the required environment variables in settings.

---

## License

MIT
