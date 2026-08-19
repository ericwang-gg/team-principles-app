// Shared wrapper for the three Claude HTTP routes (API Gateway HTTP API +
// Lambda, invoked via aws-lambda's APIGatewayProxyHandlerV2 event shape).
export function jsonHandler(fn: (input: any) => Promise<any>) {
  return async (event: { body?: string | null }) => {
    try {
      const input = JSON.parse(event.body || "{}");
      const result = await fn(input);
      return {
        statusCode: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(result),
      };
    } catch (err) {
      console.error(err);
      return {
        statusCode: 500,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      };
    }
  };
}
