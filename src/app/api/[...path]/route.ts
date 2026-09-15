import type { NextRequest } from 'next/server';
import { handleRequest } from '@/interfaces/http/controller';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ path: string[] }> };
export async function GET(request: NextRequest, context: Context) {
  return handleRequest(request, (await context.params).path.join('/'));
}
export async function POST(request: NextRequest, context: Context) {
  return handleRequest(request, (await context.params).path.join('/'));
}
