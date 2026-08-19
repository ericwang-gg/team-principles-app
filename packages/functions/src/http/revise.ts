import { Resource } from "sst";
import { revisePrinciples } from "../core/claude.js";
import { jsonHandler } from "./_json-handler.js";

if (!process.env.ANTHROPIC_API_KEY) process.env.ANTHROPIC_API_KEY = Resource.AnthropicApiKey.value;

export const handler = jsonHandler(async (input) => ({ principles: await revisePrinciples(input) }));
