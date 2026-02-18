/**
 * Sol-Automaton Type Definitions
 *
 * All shared interfaces for the Solana sovereign AI agent runtime.
 * Solana-native: PublicKey addresses, Keypair accounts, SPL tokens.
 */
import type { Keypair, PublicKey } from "@solana/web3.js";
export interface AutomatonIdentity {
    name: string;
    address: string;
    publicKey: PublicKey;
    keypair: Keypair;
    creatorAddress: string;
    sandboxId: string;
    apiKey: string;
    createdAt: string;
}
export interface WalletData {
    secretKey: number[];
    createdAt: string;
}
export interface ProvisionResult {
    apiKey: string;
    walletAddress: string;
    keyPrefix: string;
}
export interface AutomatonConfig {
    name: string;
    genesisPrompt: string;
    creatorMessage?: string;
    creatorAddress: string;
    registeredWithConway: boolean;
    sandboxId: string;
    conwayApiUrl: string;
    conwayApiKey: string;
    openaiApiKey?: string;
    anthropicApiKey?: string;
    inferenceModel: string;
    maxTokensPerTurn: number;
    heartbeatConfigPath: string;
    dbPath: string;
    logLevel: "debug" | "info" | "warn" | "error";
    walletAddress: string;
    version: string;
    skillsDir: string;
    agentId?: string;
    maxChildren: number;
    parentAddress?: string;
    socialRelayUrl?: string;
    solanaRpcUrl: string;
    solanaNetwork: "mainnet-beta" | "devnet" | "testnet";
}
export declare const DEFAULT_CONFIG: Partial<AutomatonConfig>;
export type AgentState = "setup" | "waking" | "running" | "sleeping" | "low_compute" | "critical" | "dead";
export interface AgentTurn {
    id: string;
    timestamp: string;
    state: AgentState;
    input?: string;
    inputSource?: InputSource;
    thinking: string;
    toolCalls: ToolCallResult[];
    tokenUsage: TokenUsage;
    costCents: number;
}
export type InputSource = "heartbeat" | "creator" | "agent" | "system" | "wakeup";
export interface ToolCallResult {
    id: string;
    name: string;
    arguments: Record<string, unknown>;
    result: string;
    durationMs: number;
    error?: string;
}
export interface TokenUsage {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
}
export interface AutomatonTool {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    execute: (args: Record<string, unknown>, context: ToolContext) => Promise<string>;
    dangerous?: boolean;
    category: ToolCategory;
}
export type ToolCategory = "vm" | "conway" | "self_mod" | "financial" | "survival" | "skills" | "git" | "registry" | "replication" | "solana";
export interface ToolContext {
    identity: AutomatonIdentity;
    config: AutomatonConfig;
    db: AutomatonDatabase;
    conway: ConwayClient;
    inference: InferenceClient;
    social?: SocialClientInterface;
}
export interface SocialClientInterface {
    send(to: string, content: string, replyTo?: string): Promise<{
        id: string;
    }>;
    poll(cursor?: string, limit?: number): Promise<{
        messages: InboxMessage[];
        nextCursor?: string;
    }>;
    unreadCount(): Promise<number>;
}
export interface InboxMessage {
    id: string;
    from: string;
    to: string;
    content: string;
    signedAt: string;
    createdAt: string;
    replyTo?: string;
}
export interface HeartbeatEntry {
    name: string;
    schedule: string;
    task: string;
    enabled: boolean;
    lastRun?: string;
    nextRun?: string;
    params?: Record<string, unknown>;
}
export interface HeartbeatConfig {
    entries: HeartbeatEntry[];
    defaultIntervalMs: number;
    lowComputeMultiplier: number;
}
export interface HeartbeatPingPayload {
    name: string;
    address: string;
    state: AgentState;
    creditsCents: number;
    usdcBalance: number;
    uptimeSeconds: number;
    version: string;
    sandboxId: string;
    timestamp: string;
}
export interface FinancialState {
    creditsCents: number;
    usdcBalance: number;
    solBalance: number;
    lastChecked: string;
}
export type SurvivalTier = "normal" | "low_compute" | "critical" | "dead";
export declare const SURVIVAL_THRESHOLDS: {
    readonly normal: 50;
    readonly low_compute: 10;
    readonly critical: 10;
    readonly dead: 0;
};
export interface Transaction {
    id: string;
    type: TransactionType;
    amountCents?: number;
    balanceAfterCents?: number;
    description: string;
    timestamp: string;
}
export type TransactionType = "credit_check" | "inference" | "tool_use" | "transfer_in" | "transfer_out" | "funding_request" | "spl_transfer" | "sol_transfer";
export interface ModificationEntry {
    id: string;
    timestamp: string;
    type: ModificationType;
    description: string;
    filePath?: string;
    diff?: string;
    reversible: boolean;
}
export type ModificationType = "code_edit" | "tool_install" | "mcp_install" | "config_change" | "port_expose" | "vm_deploy" | "heartbeat_change" | "prompt_change" | "skill_install" | "skill_remove" | "soul_update" | "registry_update" | "child_spawn" | "upstream_pull";
export type ThreatLevel = "low" | "medium" | "high" | "critical";
export interface SanitizedInput {
    content: string;
    blocked: boolean;
    threatLevel: ThreatLevel;
    checks: InjectionCheck[];
}
export interface InjectionCheck {
    name: string;
    detected: boolean;
    details?: string;
}
export interface ChatMessage {
    role: "system" | "user" | "assistant" | "tool";
    content: string;
    name?: string;
    tool_calls?: InferenceToolCall[];
    tool_call_id?: string;
}
export interface InferenceToolCall {
    id: string;
    type: "function";
    function: {
        name: string;
        arguments: string;
    };
}
export interface InferenceResponse {
    id: string;
    model: string;
    message: ChatMessage;
    toolCalls?: InferenceToolCall[];
    usage: TokenUsage;
    finishReason: string;
}
export interface InferenceOptions {
    model?: string;
    maxTokens?: number;
    temperature?: number;
    tools?: InferenceToolDefinition[];
    stream?: boolean;
}
export interface InferenceToolDefinition {
    type: "function";
    function: {
        name: string;
        description: string;
        parameters: Record<string, unknown>;
    };
}
export interface ConwayClient {
    exec(command: string, timeout?: number): Promise<ExecResult>;
    writeFile(path: string, content: string): Promise<void>;
    readFile(path: string): Promise<string>;
    exposePort(port: number): Promise<PortInfo>;
    removePort(port: number): Promise<void>;
    createSandbox(options: CreateSandboxOptions): Promise<SandboxInfo>;
    deleteSandbox(sandboxId: string): Promise<void>;
    listSandboxes(): Promise<SandboxInfo[]>;
    getCreditsBalance(): Promise<number>;
    getCreditsPricing(): Promise<PricingTier[]>;
    transferCredits(toAddress: string, amountCents: number, note?: string): Promise<CreditTransferResult>;
    searchDomains(query: string, tlds?: string): Promise<DomainSearchResult[]>;
    registerDomain(domain: string, years?: number): Promise<DomainRegistration>;
    listDnsRecords(domain: string): Promise<DnsRecord[]>;
    addDnsRecord(domain: string, type: string, host: string, value: string, ttl?: number): Promise<DnsRecord>;
    deleteDnsRecord(domain: string, recordId: string): Promise<void>;
    listModels(): Promise<ModelInfo[]>;
}
export interface ExecResult {
    stdout: string;
    stderr: string;
    exitCode: number;
}
export interface PortInfo {
    port: number;
    publicUrl: string;
    sandboxId: string;
}
export interface CreateSandboxOptions {
    name?: string;
    vcpu?: number;
    memoryMb?: number;
    diskGb?: number;
    region?: string;
}
export interface SandboxInfo {
    id: string;
    status: string;
    region: string;
    vcpu: number;
    memoryMb: number;
    diskGb: number;
    terminalUrl?: string;
    createdAt: string;
}
export interface PricingTier {
    name: string;
    vcpu: number;
    memoryMb: number;
    diskGb: number;
    monthlyCents: number;
}
export interface CreditTransferResult {
    transferId: string;
    status: string;
    toAddress: string;
    amountCents: number;
    balanceAfterCents?: number;
}
export interface DomainSearchResult {
    domain: string;
    available: boolean;
    registrationPrice?: number;
    renewalPrice?: number;
    currency?: string;
}
export interface DomainRegistration {
    domain: string;
    status: string;
    expiresAt?: string;
    transactionId?: string;
}
export interface DnsRecord {
    id: string;
    type: string;
    host: string;
    value: string;
    ttl?: number;
    distance?: number;
}
export interface ModelInfo {
    id: string;
    provider: string;
    pricing: {
        inputPerMillion: number;
        outputPerMillion: number;
    };
}
export interface AutomatonDatabase {
    getIdentity(key: string): string | undefined;
    setIdentity(key: string, value: string): void;
    insertTurn(turn: AgentTurn): void;
    getRecentTurns(limit: number): AgentTurn[];
    getTurnById(id: string): AgentTurn | undefined;
    getTurnCount(): number;
    insertToolCall(turnId: string, call: ToolCallResult): void;
    getToolCallsForTurn(turnId: string): ToolCallResult[];
    getHeartbeatEntries(): HeartbeatEntry[];
    upsertHeartbeatEntry(entry: HeartbeatEntry): void;
    updateHeartbeatLastRun(name: string, timestamp: string): void;
    insertTransaction(txn: Transaction): void;
    getRecentTransactions(limit: number): Transaction[];
    getInstalledTools(): InstalledTool[];
    installTool(tool: InstalledTool): void;
    removeTool(id: string): void;
    insertModification(mod: ModificationEntry): void;
    getRecentModifications(limit: number): ModificationEntry[];
    getKV(key: string): string | undefined;
    setKV(key: string, value: string): void;
    deleteKV(key: string): void;
    getSkills(enabledOnly?: boolean): Skill[];
    getSkillByName(name: string): Skill | undefined;
    upsertSkill(skill: Skill): void;
    removeSkill(name: string): void;
    getChildren(): ChildAutomaton[];
    getChildById(id: string): ChildAutomaton | undefined;
    insertChild(child: ChildAutomaton): void;
    updateChildStatus(id: string, status: ChildStatus): void;
    getRegistryEntry(): RegistryEntry | undefined;
    setRegistryEntry(entry: RegistryEntry): void;
    insertReputation(entry: ReputationEntry): void;
    getReputation(agentAddress?: string): ReputationEntry[];
    insertInboxMessage(msg: InboxMessage): void;
    getUnprocessedInboxMessages(limit: number): InboxMessage[];
    markInboxMessageProcessed(id: string): void;
    getAgentState(): AgentState;
    setAgentState(state: AgentState): void;
    close(): void;
}
export interface InstalledTool {
    id: string;
    name: string;
    type: "builtin" | "mcp" | "custom";
    config?: Record<string, unknown>;
    installedAt: string;
    enabled: boolean;
}
export interface InferenceClient {
    chat(messages: ChatMessage[], options?: InferenceOptions): Promise<InferenceResponse>;
    setLowComputeMode(enabled: boolean): void;
    getDefaultModel(): string;
}
export interface Skill {
    name: string;
    description: string;
    autoActivate: boolean;
    requires?: SkillRequirements;
    instructions: string;
    source: SkillSource;
    path: string;
    enabled: boolean;
    installedAt: string;
}
export interface SkillRequirements {
    bins?: string[];
    env?: string[];
}
export type SkillSource = "builtin" | "git" | "url" | "self";
export interface SkillFrontmatter {
    name: string;
    description: string;
    "auto-activate"?: boolean;
    requires?: SkillRequirements;
}
export interface GitStatus {
    branch: string;
    staged: string[];
    modified: string[];
    untracked: string[];
    clean: boolean;
}
export interface GitLogEntry {
    hash: string;
    message: string;
    author: string;
    date: string;
}
export interface AgentCard {
    type: string;
    name: string;
    description: string;
    services: AgentService[];
    x402Support: boolean;
    active: boolean;
    parentAgent?: string;
}
export interface AgentService {
    name: string;
    endpoint: string;
}
export interface RegistryEntry {
    agentId: string;
    agentURI: string;
    chain: string;
    assetAddress: string;
    txSignature: string;
    registeredAt: string;
}
export interface ReputationEntry {
    id: string;
    fromAgent: string;
    toAgent: string;
    score: number;
    comment: string;
    txSignature?: string;
    timestamp: string;
}
export interface DiscoveredAgent {
    agentId: string;
    owner: string;
    agentURI: string;
    name?: string;
    description?: string;
}
export interface ChildAutomaton {
    id: string;
    name: string;
    address: string;
    sandboxId: string;
    genesisPrompt: string;
    creatorMessage?: string;
    fundedAmountCents: number;
    status: ChildStatus;
    createdAt: string;
    lastChecked?: string;
}
export type ChildStatus = "spawning" | "running" | "sleeping" | "dead" | "unknown";
export interface GenesisConfig {
    name: string;
    genesisPrompt: string;
    creatorMessage?: string;
    creatorAddress: string;
    parentAddress: string;
}
export declare const MAX_CHILDREN = 3;
export interface SolanaPaymentResult {
    success: boolean;
    signature?: string;
    error?: string;
}
export interface UsdcBalanceResult {
    balance: number;
    network: string;
    ok: boolean;
    error?: string;
}
//# sourceMappingURL=types.d.ts.map