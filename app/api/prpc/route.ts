import { NextRequest, NextResponse } from "next/server";
import http from "http";
import https from "https";

async function makeHttpRequest(
  url: string,
  data: object
): Promise<{ data?: unknown; error?: string }> {
  return new Promise((resolve) => {
    try {
      const urlObj = new URL(url);
      const postData = JSON.stringify(data);
      const isHttps = urlObj.protocol === "https:";
      const httpModule = isHttps ? https : http;

      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(postData),
        },
        timeout: 5000, // 5 seconds timeout for faster offline detection
      };

      const req = httpModule.request(options, (res) => {
        let responseData = "";

        res.on("data", (chunk) => {
          responseData += chunk;
        });

        res.on("end", () => {
          try {
            const jsonData = JSON.parse(responseData);
            resolve({ data: jsonData });
          } catch {
            resolve({ error: `Invalid JSON response: ${responseData}` });
          }
        });
      });

      req.on("error", (e) => {
        resolve({ error: `Request error: ${e.message}` });
      });

      req.on("timeout", () => {
        req.destroy();
        resolve({ error: "Request timeout" });
      });

      req.write(postData);
      req.end();
    } catch (e) {
      resolve({ error: `Error: ${e instanceof Error ? e.message : "Unknown"}` });
    }
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { endpoint, method } = body;

    if (!endpoint || !method) {
      return NextResponse.json(
        { error: "Missing endpoint or method" },
        { status: 400 }
      );
    }

    const payload = {
      jsonrpc: "2.0",
      method: method,
      id: 1,
    };

    const result = await makeHttpRequest(endpoint, payload);

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json(result.data);
  } catch (error) {
    console.error("pRPC Error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
