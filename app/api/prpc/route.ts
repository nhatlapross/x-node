import { NextRequest, NextResponse } from "next/server";
import http from "http";

// Browser-like headers to avoid Cloudflare blocks
const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
  "Pragma": "no-cache",
};

// Use fetch for HTTPS endpoints (better Cloudflare compatibility)
async function makeFetchRequest(
  url: string,
  data: object
): Promise<{ data?: unknown; error?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const response = await fetch(url, {
      method: "POST",
      headers: {
        ...BROWSER_HEADERS,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const text = await response.text();

    // Check if response is Cloudflare challenge
    if (text.includes("Just a moment") || text.includes("cf_chl_opt") || text.includes("challenge-platform")) {
      return { error: "Cloudflare challenge detected - endpoint may be blocking server requests" };
    }

    try {
      const jsonData = JSON.parse(text);
      return { data: jsonData };
    } catch {
      return { error: `Invalid JSON response` };
    }
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      return { error: "Request timeout" };
    }
    return { error: `Fetch error: ${e instanceof Error ? e.message : "Unknown"}` };
  }
}

// Use native http for HTTP endpoints (faster for local nodes)
async function makeHttpRequest(
  url: string,
  data: object
): Promise<{ data?: unknown; error?: string }> {
  return new Promise((resolve) => {
    try {
      const urlObj = new URL(url);
      const postData = JSON.stringify(data);
      const isHttps = urlObj.protocol === "https:";

      // Use fetch for HTTPS (better Cloudflare handling)
      if (isHttps) {
        makeFetchRequest(url, data).then(resolve);
        return;
      }

      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || 80,
        path: urlObj.pathname,
        method: "POST",
        headers: {
          ...BROWSER_HEADERS,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(postData),
        },
        timeout: 5000, // 5 seconds timeout for faster offline detection
      };

      const req = http.request(options, (res) => {
        let responseData = "";

        res.on("data", (chunk) => {
          responseData += chunk;
        });

        res.on("end", () => {
          try {
            const jsonData = JSON.parse(responseData);
            resolve({ data: jsonData });
          } catch {
            resolve({ error: `Invalid JSON response` });
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
    let body;
    try {
      body = await request.json();
    } catch (e) {
      console.error("Failed to parse request body:", e);
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const { endpoint, method } = body;

    if (!endpoint || !method) {
      console.error("Missing endpoint or method:", body);
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
      // Return 200 with error in body - the node being offline is not a server error
      return NextResponse.json({ error: result.error });
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
