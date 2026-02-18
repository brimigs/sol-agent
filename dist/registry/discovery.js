/**
 * Solana Agent Discovery
 *
 * Discover other agents via Solana registry queries.
 * Fetches and parses agent cards from Metaplex Core NFT URIs.
 */
import { queryAgent } from "./solana-registry.js";
/**
 * Fetch an agent card from a URI (IPFS or HTTP).
 */
export async function fetchAgentCard(uri) {
    try {
        let fetchUrl = uri;
        if (uri.startsWith("ipfs://")) {
            fetchUrl = `https://ipfs.io/ipfs/${uri.slice(7)}`;
        }
        const response = await fetch(fetchUrl, {
            signal: AbortSignal.timeout(10000),
        });
        if (!response.ok)
            return null;
        const card = (await response.json());
        if (!card.name || !card.type)
            return null;
        return card;
    }
    catch {
        return null;
    }
}
/**
 * Look up a specific agent by their Solana asset address.
 */
export async function discoverAgentByAddress(assetAddress, network = "mainnet-beta", rpcUrl) {
    const agent = await queryAgent(assetAddress, network, rpcUrl);
    if (!agent)
        return null;
    try {
        const card = await fetchAgentCard(agent.agentURI);
        if (card) {
            agent.name = card.name;
            agent.description = card.description;
        }
    }
    catch { }
    return agent;
}
/**
 * Discover agents by scanning known agent addresses stored in the registry.
 * On Solana, there's no sequential token ID, so we scan the Conway registry API.
 */
export async function discoverAgents(limit = 20, network = "mainnet-beta", rpcUrl) {
    try {
        // Query Conway's agent registry endpoint for known Solana agents
        const resp = await fetch(`https://api.conway.tech/v1/registry/agents?network=solana:${network}&limit=${limit}`);
        if (!resp.ok)
            return [];
        const data = (await resp.json());
        const agents = [];
        for (const item of data.agents || []) {
            const agent = {
                agentId: item.assetAddress,
                owner: item.owner,
                agentURI: item.uri,
                name: item.name,
                description: item.description,
            };
            // Optionally enrich with agent card
            if (!agent.name && agent.agentURI) {
                try {
                    const card = await fetchAgentCard(agent.agentURI);
                    if (card) {
                        agent.name = card.name;
                        agent.description = card.description;
                    }
                }
                catch { }
            }
            agents.push(agent);
        }
        return agents;
    }
    catch {
        return [];
    }
}
/**
 * Search for agents by name or description.
 */
export async function searchAgents(keyword, limit = 10, network = "mainnet-beta", rpcUrl) {
    const all = await discoverAgents(50, network, rpcUrl);
    const lower = keyword.toLowerCase();
    return all
        .filter((a) => a.name?.toLowerCase().includes(lower) ||
        a.description?.toLowerCase().includes(lower) ||
        a.owner.toLowerCase().includes(lower))
        .slice(0, limit);
}
//# sourceMappingURL=discovery.js.map