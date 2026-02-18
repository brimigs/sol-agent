/**
 * Agent Card
 *
 * Generates and manages the agent's self-description card.
 * This is the JSON document pointed to by the Solana registry NFT URI.
 * Can be hosted on IPFS or served at /.well-known/agent-card.json
 */
const AGENT_CARD_TYPE = "https://github.com/sol-automaton/agent-registry#v1";
/**
 * Generate an agent card from the automaton's current state.
 */
export function generateAgentCard(identity, config, db) {
    const services = [
        {
            name: "agentWallet",
            endpoint: `solana:${config.solanaNetwork}:${identity.address}`,
        },
        {
            name: "conway",
            endpoint: config.conwayApiUrl,
        },
    ];
    if (identity.sandboxId) {
        services.push({
            name: "sandbox",
            endpoint: `https://${identity.sandboxId}.life.conway.tech`,
        });
    }
    const children = db.getChildren();
    const skills = db.getSkills(true);
    let description = `Autonomous Solana agent running on Conway.`;
    description += ` Creator: ${config.creatorAddress}.`;
    if (skills.length > 0) {
        description += ` Skills: ${skills.map((s) => s.name).join(", ")}.`;
    }
    if (children.length > 0) {
        description += ` Children: ${children.length}.`;
    }
    return {
        type: AGENT_CARD_TYPE,
        name: config.name,
        description,
        services,
        x402Support: false, // Solana uses SPL token pay instead
        active: true,
        parentAgent: config.parentAddress || config.creatorAddress,
    };
}
export function serializeAgentCard(card) {
    return JSON.stringify(card, null, 2);
}
/**
 * Host the agent card at /.well-known/agent-card.json
 */
export async function hostAgentCard(card, conway, port = 8004) {
    const cardJson = serializeAgentCard(card);
    const serverScript = `
const http = require('http');
const card = ${cardJson};

const server = http.createServer((req, res) => {
  if (req.url === '/.well-known/agent-card.json' || req.url === '/agent-card.json') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(card, null, 2));
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

server.listen(${port}, () => console.log('Agent card server on port ${port}'));
`;
    await conway.writeFile("/tmp/agent-card-server.js", serverScript);
    await conway.exec("node /tmp/agent-card-server.js &", 5000);
    const portInfo = await conway.exposePort(port);
    return `${portInfo.publicUrl}/.well-known/agent-card.json`;
}
/**
 * Write agent card to the state directory for git versioning.
 */
export async function saveAgentCard(card, conway) {
    const cardJson = serializeAgentCard(card);
    const home = process.env.HOME || "/root";
    await conway.writeFile(`${home}/.sol-automaton/agent-card.json`, cardJson);
}
//# sourceMappingURL=agent-card.js.map