/// <reference path="./.sst/platform/config.d.ts" />

// KNOWN GAPS — verify these on the first real `sst dev`/`sst deploy` (no AWS
// account was configured on this machine when this was scaffolded, so none
// of this has been exercised against real AWS yet):
//   1. IAM permission for `execute-api:ManageConnections` on the Realtime
//      WebSocket API for the `$default` route's function — SST's
//      ApiGatewayWebSocket doesn't yet have a documented way to link an API
//      to its own route handlers (github.com/sst/sst/issues/4633). May need
//      an explicit `permissions: [...]` grant once you see the IAM error.
//   2. Confirm `packages/web` build output directory matches `build.output`
//      below once the Vite app exists beyond this scaffold.
export default $config({
  app(input) {
    return {
      name: "team-principles",
      // Dev/personal stages get torn down cleanly; only "production" retains
      // data (Dynamo table) if you ever remove the stack.
      removal: input?.stage === "production" ? "retain" : "remove",
      home: "aws",
    };
  },
  async run() {
    const anthropicApiKey = new sst.Secret("AnthropicApiKey");

    const connections = new sst.aws.Dynamo("Connections", {
      fields: { connectionId: "string", room: "string" },
      primaryIndex: { hashKey: "connectionId" },
      globalIndexes: { byRoom: { hashKey: "room" } },
    });

    const realtime = new sst.aws.ApiGatewayWebSocket("Realtime");
    realtime.route("$connect", {
      handler: "packages/functions/src/ws/connect.handler",
      link: [connections],
    });
    realtime.route("$disconnect", {
      handler: "packages/functions/src/ws/disconnect.handler",
      link: [connections],
    });
    realtime.route("$default", {
      handler: "packages/functions/src/ws/default.handler",
      link: [connections],
      environment: { WS_MANAGEMENT_ENDPOINT: realtime.managementEndpoint },
      permissions: [
        {
          actions: ["execute-api:ManageConnections"],
          resources: [$interpolate`${realtime.nodes.api.executionArn}/*/*`],
        },
      ],
    });

    const claudeApi = new sst.aws.ApiGatewayV2("ClaudeApi");
    const claudeRoute = { link: [anthropicApiKey] };
    claudeApi.route("POST /topics", { handler: "packages/functions/src/http/topics.handler", ...claudeRoute });
    claudeApi.route("POST /principles", { handler: "packages/functions/src/http/principles.handler", ...claudeRoute });
    claudeApi.route("POST /revise", { handler: "packages/functions/src/http/revise.handler", ...claudeRoute });

    const web = new sst.aws.StaticSite("Web", {
      path: "packages/web",
      build: {
        command: "npm run build",
        output: "dist",
      },
      environment: {
        VITE_WS_URL: realtime.url,
        VITE_API_URL: claudeApi.url,
      },
    });

    return {
      web: web.url,
      realtime: realtime.url,
      claudeApi: claudeApi.url,
    };
  },
});
