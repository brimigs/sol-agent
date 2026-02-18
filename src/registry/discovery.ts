/**
 * Solana Agent Discovery
 *
 * Discover other agents via Solana registry queries.
 * Fetches and parses agent cards from Metaplex Core NFT URIs.
 */

import type { DiscoveredAgent, AgentCard } from "../types.js";
import { queryAgent } from "./solana-registry.js";
import { Connection, PublicKey } from "@solana/web3.js";
import { getRpcUrl } from "../solana/usdc.js";

type Network = "mainnet-beta" | "devnet";

/**
 * Fetch an agent card from a URI (IPFS or HTTP).
 */
export async function fetchAgentCard(
  uri: string,
): Promise<AgentCard | null> {
  try {
    let fetchUrl = uri;
    if (uri.startsWith("ipfs://")) {
      fetchUrl = `https://ipfs.io/ipfs/${uri.slice(7)}`;
    }

    const response = await fetch(fetchUrl, {
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) return null;
    const card = (await response.json()) as AgentCard;
    if (!card.name || !card.type) return null;
    return card;
  } catch {
    return null;
  }
}

/**
 * Look up a specific agent by their Solana asset address.
 */
export async function discoverAgentByAddress(
  assetAddress: string,
  network: Network = "mainnet-beta",
  rpcUrl?: string,
): Promise<DiscoveredAgent | null> {
  const agent = await queryAgent(assetAddress, network, rpcUrl);
  if (!agent) return null;

  try {
    const card = await fetchAgentCard(agent.agentURI);
    if (card) {
      agent.name = card.name;
      agent.description = card.description;
    }
  } catch {}

  return agent;
}

/**
 * Discover agents by scanning known agent addresses stored in the registry.
 * On Solana, there's no sequential token ID, so we scan the Conway registry API.
 */
export async function discoverAgents(
  limit: number = 20,
  network: Network = "mainnet-beta",
  rpcUrl?: string,
): Promise<DiscoveredAgent[]> {
  try {
    // Query Conway's agent registry endpoint for known Solana agents
    const resp = await fetch(`https://api.conway.tech/v1/registry/agents?network=solana:${network}&limit=${limit}`);
    if (!resp.ok) return [];

    const data = (await resp.json()) as { agents: Array<{ assetAddress: string; name?: string; description?: string; owner: string; uri: string }> };
    const agents: DiscoveredAgent[] = [];

    for (const item of data.agents || []) {
      const agent: DiscoveredAgent = {
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
        } catch {}
      }

      agents.push(agent);
    }

    return agents;
  } catch {
    return [];
  }
}

/**
 * Search for agents by name or description.
 */
export async function searchAgents(
  keyword: string,
  limit: number = 10,
  network: Network = "mainnet-beta",
  rpcUrl?: string,
): Promise<DiscoveredAgent[]> {
  const all = await discoverAgents(50, network, rpcUrl);
  const lower = keyword.toLowerCase();

  return all
    .filter(
      (a) =>
        a.name?.toLowerCase().includes(lower) ||
        a.description?.toLowerCase().includes(lower) ||
        a.owner.toLowerCase().includes(lower),
    )
    .slice(0, limit);
}
