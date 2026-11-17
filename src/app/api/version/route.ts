export async function GET() {
  return Response.json({
    status: 'ok',
    version: '4760529-multitenant',
    timestamp: new Date().toISOString(),
  });
}
