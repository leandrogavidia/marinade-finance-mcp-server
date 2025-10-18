import z from "zod";
import type { MarinadeFinanceTool } from "./types.js";
import { createMarinadeFinanceDocsMcpClient } from "./client.js";

export const marinadeFinanceTools: MarinadeFinanceTool[] = [
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
                                    error: isAbort ? "Request timed out" : "Failed to fetch account",
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
]