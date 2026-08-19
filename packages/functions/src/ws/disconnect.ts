// Production WebSocket relay ($disconnect route). See connect.ts for caveats.
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DeleteCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export async function handler(event: any) {
  const connectionId = event.requestContext.connectionId;

  await ddb.send(
    new DeleteCommand({
      TableName: Resource.Connections.name,
      Key: { connectionId },
    })
  );

  return { statusCode: 200 };
}
