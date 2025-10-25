import z from "zod";
import type { MarinadeFinanceTool } from "./types.js";
import { createMarinadeFinanceDocsMcpClient } from "./client.js";
import { Marinade, MarinadeConfig, MarinadeUtils } from '@marinade.finance/marinade-ts-sdk'
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, sendAndConfirmTransaction } from "@solana/web3.js";
import bs58 from "bs58";
import { McpLogger } from "./logger.js";

// @ts-ignore - Import SPL token functions (TypeScript may show errors but these exist at runtime in v0.4.14)
import { getOrCreateAssociatedTokenAccount, transfer, getAccount } from "@solana/spl-token";

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

    // Marinade Finance State

    {
        name: "get_marinade_state",
        title: "Get Marinade State",
        description: "Retrieve the current state of the Marinade Finance protocol, including information about staked assets, mint address, price, rewards, and other relevant data.",
        inputSchema: {},
        callback: async () => {
            try {
                const marinade = new Marinade()
                const marinadeStateRaw = await marinade.getMarinadeState();

                const visited = new WeakSet();

                const marinadeState = JSON.parse(JSON.stringify(marinadeStateRaw, (key, value) => {
                    if (value === null || typeof value !== 'object') {
                        return value;
                    }

                    if (visited.has(value)) {
                        return '[Circular Reference]';
                    }
                    visited.add(value);

                    if (value && value.constructor?.name === 'PublicKey') {
                        return value.toString();
                    }

                    if (value && value.constructor?.name === 'BN') {
                        return value.toString();
                    }

                    const problematicTypes = [
                        'Marinade',
                        'MarinadeReferralProgram',
                        'RpcWebSocketClient',
                        'Connection',
                        'EventEmitter',
                        'Events'
                    ];

                    if (value.constructor && problematicTypes.includes(value.constructor.name)) {
                        return '[Filtered Object: ' + value.constructor.name + ']';
                    }

                    if (typeof value === 'function' ||
                        (value && value._events)) {
                        return undefined;
                    }

                    return value;
                }));

                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(marinadeState, null, 2),
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
                                    error: isAbort ? "Request timed out" : "Failed to fetch Marinade State",
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
    // Balance Check
    {
        name: "get_msol_balance",
        title: "Get mSOL Balance",
        description: "Check the mSOL token balance of the environment wallet or any specified Solana wallet address.",
        inputSchema: {
            walletAddress: z.string().optional().describe("Optional: The Solana wallet address to check. If not provided, checks the environment wallet balance."),
        },
        callback: async ({ walletAddress }: { walletAddress?: string }) => {
            try {
                const { wallet, connection } = createSolanaConfig()

                const config = new MarinadeConfig({
                    connection,
                    publicKey: wallet.publicKey,
                })

                const marinade = new Marinade(config)
                const marinadeState = await marinade.getMarinadeState();
                const mSolMint = marinadeState.mSolMintAddress;

                let targetPublicKey: PublicKey;
                let isOwnWallet = true;

                if (walletAddress) {
                    try {
                        targetPublicKey = new PublicKey(walletAddress);
                        isOwnWallet = targetPublicKey.toString() === wallet.publicKey.toString();
                    } catch (err) {
                        return {
                            content: [
                                {
                                    type: "text",
                                    text: JSON.stringify({
                                        error: "Invalid wallet address",
                                        reason: "The provided wallet address is not a valid Solana public key"
                                    }, null, 2),
                                },
                            ],
                        };
                    }
                } else {
                    targetPublicKey = wallet.publicKey;
                }

                try {
                    const tokenAccount = await getOrCreateAssociatedTokenAccount(
                        connection,
                        wallet,
                        mSolMint,
                        targetPublicKey,
                        false
                    );

                    const balance = Number(tokenAccount.amount);
                    const balanceInMSol = balance / LAMPORTS_PER_SOL;

                    return {
                        content: [
                            {
                                type: "text",
                                text: JSON.stringify({
                                    success: true,
                                    wallet: targetPublicKey.toString(),
                                    tokenAccount: tokenAccount.address.toString(),
                                    balance: balanceInMSol,
                                    balanceLamports: balance.toString(),
                                    mSolMint: mSolMint.toString(),
                                    explorerUrl: `https://solscan.io/account/${tokenAccount.address.toString()}${process.env.ENVIRONMENT === 'MAINNET' ? '' : '?cluster=devnet'}`
                                }, null, 2),
                            },
                        ],
                    };
                } catch (err) {
                    if ((err as Error)?.message?.includes("could not find") || 
                        (err as Error)?.message?.includes("Invalid account")) {
                        return {
                            content: [
                                {
                                    type: "text",
                                    text: JSON.stringify({
                                        success: true,
                                        wallet: targetPublicKey.toString(),
                                        balance: 0,
                                        balanceLamports: "0",
                                        mSolMint: mSolMint.toString(),
                                        note: "No mSOL token account found for this wallet (balance is 0)"
                                    }, null, 2),
                                },
                            ],
                        };
                    }
                    throw err;
                }

            } catch (err) {
                const isAbort = (err as Error)?.name === "AbortError";
                const isTimeout = (err as Error)?.message?.includes("timeout");

                McpLogger.error("Error in get_msol_balance tool:", String(err));

                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(
                                {
                                    error: isAbort || isTimeout ? "Request timed out" : "Failed to get mSOL balance",
                                    reason: String((err as Error)?.message ?? err),
                                    suggestion: isAbort || isTimeout ?
                                        "Try again with a different RPC endpoint." :
                                        "Please check the wallet address and network connection."
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

    // mSOL Transfers

    {
        name: "send_msol",
        title: "Send mSOL to Another Wallet",
        description: "Send mSOL tokens to another Solana wallet address. This tool automatically checks if the recipient's mSOL token account exists and creates it if necessary.",
        inputSchema: {
            recipientAddress: z.string().describe("The Solana wallet address of the recipient"),
            amount: z.number().min(0).describe("The amount of mSOL to send"),
        },
        callback: async ({ recipientAddress, amount }: { recipientAddress: string; amount: number }) => {
            try {
                const amountLamports = MarinadeUtils.solToLamports(amount);

                const { wallet, connection } = createSolanaConfig()

                const config = new MarinadeConfig({
                    connection,
                    publicKey: wallet.publicKey,
                })

                const marinade = new Marinade(config)
                const marinadeState = await marinade.getMarinadeState();
                const mSolMint = marinadeState.mSolMintAddress;

                let recipientPublicKey: PublicKey;
                try {
                    recipientPublicKey = new PublicKey(recipientAddress);
                } catch (err) {
                    return {
                        content: [
                            {
                                type: "text",
                                text: JSON.stringify({
                                    error: "Invalid recipient address",
                                    reason: "The provided recipient address is not a valid Solana public key"
                                }, null, 2),
                            },
                        ],
                    };
                }

                const senderTokenAccount = await getOrCreateAssociatedTokenAccount(
                    connection,
                    wallet,
                    mSolMint,
                    wallet.publicKey
                );

                const senderBalance = Number(senderTokenAccount.amount);
                if (senderBalance < amountLamports) {
                    return {
                        content: [
                            {
                                type: "text",
                                text: JSON.stringify({
                                    error: "Insufficient mSOL balance",
                                    reason: `Required: ${amount} mSOL (${amountLamports} lamports), Available: ${senderBalance / LAMPORTS_PER_SOL} mSOL (${senderBalance} lamports)`
                                }, null, 2),
                            },
                        ],
                    };
                }

                const recipientTokenAccount = await getOrCreateAssociatedTokenAccount(
                    connection,
                    wallet,
                    mSolMint,
                    recipientPublicKey,
                    false
                );

                const accountCreated = recipientTokenAccount.amount === BigInt(0) &&
                    senderTokenAccount.address.toString() !== recipientTokenAccount.address.toString();

                const signature = await transfer(
                    connection,
                    wallet,
                    senderTokenAccount.address,
                    recipientTokenAccount.address,
                    wallet.publicKey,
                    amountLamports
                );

                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                success: true,
                                signature,
                                recipient: recipientAddress,
                                recipientTokenAccount: recipientTokenAccount.address.toString(),
                                accountCreated: accountCreated ? "A new token account was created for the recipient" : "Used existing token account",
                                amountSent: amount,
                                amountSentLamports: amountLamports.toString(),
                                explorerUrl: `https://solscan.io/tx/${signature}${process.env.ENVIRONMENT === 'MAINNET' ? '' : '?cluster=devnet'}`
                            }, null, 2),
                        },
                    ],
                };

            } catch (err) {
                const isAbort = (err as Error)?.name === "AbortError";
                const isTimeout = (err as Error)?.message?.includes("timeout");

                McpLogger.error("Error in send_msol tool:", String(err));

                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(
                                {
                                    error: isAbort || isTimeout ? "Request timed out" : "Failed to send mSOL",
                                    reason: String((err as Error)?.message ?? err),
                                    suggestion: isAbort || isTimeout ?
                                        "The transaction may still be processing. Check your wallet or try again with a different RPC endpoint." :
                                        "Please check the recipient address, your mSOL balance, and network connection."
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