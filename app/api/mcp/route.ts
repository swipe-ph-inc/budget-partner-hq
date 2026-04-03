import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { handleMCPTool } from "@/lib/mcp/handlers";
import { MCP_TOOLS } from "@/lib/mcp/tools";
import { z } from "zod";

// MCP JSON-RPC 2.0 over HTTP
const RpcRequestSchema = z.object({
  jsonrpc: z.literal("2.0"),
  method: z.string(),
  params: z.record(z.string(), z.unknown()).optional(),
  id: z.union([z.string(), z.number()]).optional(),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { jsonrpc: "2.0", error: { code: -32001, message: "Unauthorized" }, id: null },
      { status: 401 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({
      jsonrpc: "2.0",
      error: { code: -32700, message: "Parse error" },
      id: null,
    }, { status: 400 });
  }

  const parsed = RpcRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({
      jsonrpc: "2.0",
      error: { code: -32600, message: "Invalid request", data: parsed.error.flatten() },
      id: null,
    }, { status: 400 });
  }

  const { method, params, id } = parsed.data;

  // List tools
  if (method === "tools/list") {
    return NextResponse.json({
      jsonrpc: "2.0",
      result: { tools: MCP_TOOLS },
      id,
    });
  }

  // Execute tool
  if (method === "tools/call") {
    const { name, arguments: args } = (params ?? {}) as { name: string; arguments: Record<string, unknown> };

    const toolExists = MCP_TOOLS.some((t) => t.name === name);
    if (!toolExists) {
      return NextResponse.json({
        jsonrpc: "2.0",
        error: { code: -32601, message: `Tool not found: ${name}` },
        id,
      }, { status: 404 });
    }

    try {
      const result = await handleMCPTool(name, args ?? {}, user.id);
      return NextResponse.json({
        jsonrpc: "2.0",
        result: { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] },
        id,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal error";
      return NextResponse.json({
        jsonrpc: "2.0",
        error: { code: -32603, message },
        id,
      }, { status: 500 });
    }
  }

  return NextResponse.json({
    jsonrpc: "2.0",
    error: { code: -32601, message: `Method not found: ${method}` },
    id,
  }, { status: 404 });
}

export async function GET() {
  return NextResponse.json({
    name: "Budget Partner HQ MCP Server",
    version: "1.0.0",
    tools: MCP_TOOLS.map((t) => ({ name: t.name, description: t.description })),
  });
}
