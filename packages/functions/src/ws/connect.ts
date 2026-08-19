// Production WebSocket relay ($connect route).
//
// NOTE: this is scaffolded against SST's documented ApiGatewayWebSocket API
// (https://sst.dev/docs/component/aws/apigateway-websocket/) but has not been
// deployed or exercised yet — there's no AWS account wired up on this machine
// yet. Treat the first `sst dev` run against real AWS as the real test of
// this file, and expect to iterate (SST resource names, IAM permissions for
// execute-api:ManageConnections in particular — see README "Known gaps").
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export async function handler(event: any) {
  const connectionId = event.requestContext.connectionId;
  const room = event.queryStringParameters?.room ?? "default";

  await ddb.send(
    new PutCommand({
      TableName: Resource.Connections.name,
      Item: { connectionId, room, connectedAt: Date.now() },
    })
  );

  return { statusCode: 200 };
}
