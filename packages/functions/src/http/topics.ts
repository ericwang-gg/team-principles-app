import { Resource } from "sst";
import { synthesizeTopics } from "../core/claude.js";
import { jsonHandler } from "./_json-handler.js";

// Linked via `link: [anthropicApiKey]` in sst.config.ts. Setting it into
// process.env keeps core/claude.ts free of any SST-specific imports, so the
// exact same function also runs from local-dev/api-server.ts.
if (!process.env.ANTHROPIC_API_KEY) process.env.ANTHROPIC_API_KEY = Resource.AnthropicApiKey.value;

export const handler = jsonHandler(async (input) => ({ topics: await synthesizeTopics(input) }));
