import z from "zod";
import type { MarinadeFinanceTool } from "./types.js";
import { createMarinadeFinanceDocsMcpClient } from "./client.js";
import { Marinade, MarinadeConfig, MarinadeUtils } from '@marinade.finance/marinade-ts-sdk'
import { Connection, Keypair, LAMPORTS_PER_SOL, sendAndConfirmTransaction } from "@solana/web3.js";
import bs58 from "bs58";
import { McpLogger } from "./logger.js";

function createSolanaConfig() {
    const isMainnet = process.env.ENVIRONMENT === "MAINNET";
    const privateKey = process.env.PRIVATE_KEY || '';

    const rpcUrlMainnet = process.env.SOLANA_RPC_URL
    const rpcUrlDevnet = process.env.SOLANA_RPC_URL_DEVNET;

    const rpcUrl = isMainnet ? rpcUrlMainnet : rpcUrlDevnet;

    if (!privateKey || !rpcUrlMainnet || !rpcUrlDevnet || !rpcUrl) {
        throw new Error("PRIVATE_KEY, SOLANA_RPC_URL, SOLANA_RPC_URL_DEVNET environment variables are required");
    }

    const wallet = Keypair.fromSecretKey(bs58.decode(privateKey));
    const connection = new Connection(rpcUrl, {
        commitment: "confirmed",
    });

    return { wallet, connection };
}

function hasSecretKey(): boolean {
    const privateKey = process.env.PRIVATE_KEY;
    const rpcUrl = process.env.SOLANA_RPC_URL;
    const rpcUrlDevnet = process.env.SOLANA_RPC_URL_DEVNET;

    if (!privateKey || !rpcUrl || !rpcUrlDevnet) {
        return false;
    }

    return true;
}

const publicTools: MarinadeFinanceTool[] = [
    // Marinade Finance DOCS
    {
        name: "search_documentation",
        title: "Search Marinade Finance Documentation",
        description: "Search across the documentation to find relevant information, code examples, API references, and guides. Use this tool when you need to answer questions about Marinade Finance Docs, find specific documentation, understand how features work, or locate implementation details. The search returns contextual content with titles and direct links to the documentation pages.",
        inputSchema: {
            query: z.string().describe("The search query string"),
        },
        callback: async ({ query }: { query: string }) => {
            try {
                const marinadeFinanceDocsMcpClient = await createMarinadeFinanceDocsMcpClient();

                const response = await marinadeFinanceDocsMcpClient.client.callTool({ name: "searchDocumentation", arguments: { query } })

                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(response, null, 2),
                        },
                    ],
                };

            } catch (err) {
                const isAbort = (err as Error)?.name === "AbortError";

                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(
                                {
                                    error: isAbort ? "Request timed out" : "Failed to fetch documentation",
                                    reason: String((err as Error)?.message ?? err),
                                },
                                null,
                                2
                            ),
                        },
                    ],
                };
            }
        }
    },
];

const onChainTools: MarinadeFinanceTool[] = [
    // LST Staking
    {
        name: "stake_msol",
        title: "Stake SOL for mSOL",
        description: "Stake your SOL tokens with Marinade Finance to receive mSOL tokens and earn rewards.",
        inputSchema: {
            amount: z.number().min(0).describe("The amount of SOL to stake"),
        },
        callback: async ({ amount }: { amount: number }) => {
            try {
                const amountLamports = MarinadeUtils.solToLamports(amount);

                const { wallet, connection } = createSolanaConfig()

                const balance = await connection.getBalance(wallet.publicKey);
                if (balance < amountLamports) {
                    return {
                        content: [
                            {
                                type: "text",
                                text: JSON.stringify({
                                    error: "Insufficient balance",
                                    reason: `Required: ${amount} SOL (${amountLamports} lamports), Available: ${balance / LAMPORTS_PER_SOL} SOL (${balance} lamports)`
                                }, null, 2),
                            },
                        ],
                    };
                }

                const config = new MarinadeConfig({
                    connection,
                    publicKey: wallet.publicKey,
                })

                const marinade = new Marinade(config)

                const {
                    associatedMSolTokenAccountAddress,
                    transaction,
                } = await marinade.deposit(amountLamports, {
                    mintToOwnerAddress: wallet.publicKey,
                })

                const signature = await sendAndConfirmTransaction(connection, transaction, [wallet], {
                    commitment: "confirmed",
                    preflightCommitment: "processed",
                    skipPreflight: false,
                    maxRetries: 3,
                })

                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                success: true,
                                signature,
                                mSolTokenAccount: associatedMSolTokenAccountAddress,
                                amountStaked: amount,
                                amountStakedLamports: amountLamports.toString(),
                                explorerUrl: `https://solscan.io/tx/${signature}${process.env.ENVIRONMENT === 'MAINNET' ? '' : '?cluster=devnet'}`
                            }, null, 2),
                        },
                    ],
                };

            } catch (err) {
                const isAbort = (err as Error)?.name === "AbortError";
                const isTimeout = (err as Error)?.message?.includes("timeout");

                McpLogger.error("Error in stake_msol tool:", String(err));

                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(
                                {
                                    error: isAbort || isTimeout ? "Request timed out" : "Failed to stake SOL",
                                    reason: String((err as Error)?.message ?? err),
                                    suggestion: isAbort || isTimeout ?
                                        "The transaction may still be processing. Check your wallet or try again with a different RPC endpoint." :
                                        "Please check your wallet balance and network connection."
                                },
                                null,
                                2
                            ),
                        },
                    ],
                };
            }
        }
    },

    {
        name: "unstake_msol",
        title: "Unstake mSOL",
        description: "Unstake your mSOL tokens with Marinade Finance to receive SOL tokens.",
        inputSchema: {
            amount: z.number().min(0).describe("The amount of mSOL to unstake"),
        },
        callback: async ({ amount }: { amount: number }) => {
            try {
                const amountLamports = MarinadeUtils.solToLamports(amount);

                const { wallet, connection } = createSolanaConfig()

                const config = new MarinadeConfig({
                    connection,
                    publicKey: wallet.publicKey,
                })

                const marinade = new Marinade(config)

                const {
                    associatedMSolTokenAccountAddress,
                    transaction,
                } = await marinade.liquidUnstake(amountLamports)

                const signature = await sendAndConfirmTransaction(connection, transaction, [wallet], {
                    commitment: "confirmed",
                    preflightCommitment: "processed",
                    skipPreflight: false,
                    maxRetries: 3,
                })

                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                success: true,
                                signature,
                                mSolTokenAccount: associatedMSolTokenAccountAddress,
                                amountUnstaked: amount,
                                amountUnstakedLamports: amountLamports.toString(),
                                explorerUrl: `https://solscan.io/tx/${signature}${process.env.ENVIRONMENT === 'MAINNET' ? '' : '?cluster=devnet'}`
                            }, null, 2),
                        },
                    ],
                };

            } catch (err) {
                const isAbort = (err as Error)?.name === "AbortError";
                const isTimeout = (err as Error)?.message?.includes("timeout");

                McpLogger.error("Error in stake_msol tool:", String(err));

                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(
                                {
                                    error: isAbort || isTimeout ? "Request timed out" : "Failed to stake SOL",
                                    reason: String((err as Error)?.message ?? err),
                                    suggestion: isAbort || isTimeout ?
                                        "The transaction may still be processing. Check your wallet or try again with a different RPC endpoint." :
                                        "Please check your wallet balance and network connection."
                                },
                                null,
                                2
                            ),
                        },
                    ],
                };
            }
        }
    },
];

export const marinadeFinanceTools: MarinadeFinanceTool[] = hasSecretKey() ? [...publicTools, ...onChainTools] : [...publicTools];