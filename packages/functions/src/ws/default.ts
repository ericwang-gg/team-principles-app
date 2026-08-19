// Production WebSocket relay ($default route) — fans out any message a
// client sends to every other connection in the same room, matching the
// local-dev/relay-server.ts contract exactly. See connect.ts for caveats.
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from "@aws-sdk/client-apigatewaymanagementapi";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DeleteCommand, DynamoDBDocumentClient, GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export async function handler(event: any) {
  const connectionId = event.requestContext.connectionId;

  const self = await ddb.send(
    new GetCommand({ TableName: Resource.Connections.name, Key: { connectionId } })
  );
  const room = self.Item?.room;
  if (!room) return { statusCode: 200 };

  const peers = await ddb.send(
    new QueryCommand({
      TableName: Resource.Connections.name,
      IndexName: "byRoom",
      KeyConditionExpression: "room = :r",
      ExpressionAttributeValues: { ":r": room },
    })
  );

  // Passed in as a plain env var from sst.config.ts (WS_MANAGEMENT_ENDPOINT),
  // rather than via Resource linking — at the time this was scaffolded,
  // ApiGatewayWebSocket didn't have a clean way to link its own
  // managementEndpoint/permissions into its own route handlers
  // (see https://github.com/sst/sst/issues/4633). Revisit once that's resolved.
  const api = new ApiGatewayManagementApiClient({ endpoint: process.env.WS_MANAGEMENT_ENDPOINT });

  await Promise.all(
    (peers.Items ?? [])
      .filter((p) => p.connectionId !== connectionId)
      .map((p) =>
        api
          .send(new PostToConnectionCommand({ ConnectionId: p.connectionId, Data: event.body }))
          .catch(() =>
            // Stale connection (client disconnected without a clean close) — clean it up.
            ddb.send(new DeleteCommand({ TableName: Resource.Connections.name, Key: { connectionId: p.connectionId } }))
          )
      )
  );

  return { statusCode: 200 };
}
