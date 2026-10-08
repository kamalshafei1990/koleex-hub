/* Unit-proof of the size-omission fix — fake fetch, no network. Verifies:
   1. AI_IMAGE_SIZE=none → request body has NO size field, extra body rides along
   2. default (unset)     → body carries size 1024x1024 (old vendors unchanged) */
import { generateImage, parseImageConfig, diagnoseImageConfig } from "../src/lib/server/ai/image-gen";

const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

function fakeFetch(captured: { body?: unknown }) {
  return (async (_url: unknown, init?: { body?: string }) => {
    captured.body = JSON.parse(init?.body ?? "{}");
    return new Response(JSON.stringify({ data: [{ b64_json: PNG_1PX.toString("base64") }] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as unknown as typeof fetch;
}

async function main() {
  const store = async () => "https://example.test/img.png";

  // Case 1: size omitted
  const cap1: { body?: Record<string, unknown> } = {};
  const r1 = await generateImage("test", {
    fetch: fakeFetch(cap1),
    store,
    env: {
      AI_IMAGE_BASE_URL: "https://api.x.ai/v1",
      AI_IMAGE_API_KEY: "test-key",
      AI_IMAGE_MODEL: "grok-imagine-image-2.0",
      AI_IMAGE_SIZE: "none",
      AI_IMAGE_EXTRA_BODY: '{"aspect_ratio":"1:1","resolution":"1k"}',
    },
  });
  const b1 = cap1.body ?? {};
  console.log("case1 outcome ok:", r1.configured && r1.ok);
  console.log("case1 body has size:", "size" in b1, "| aspect_ratio:", b1.aspect_ratio, "| resolution:", b1.resolution, "| model:", b1.model);

  // Case 2: default size preserved
  const cap2: { body?: Record<string, unknown> } = {};
  const r2 = await generateImage("test", {
    fetch: fakeFetch(cap2),
    store,
    env: {
      AI_IMAGE_BASE_URL: "https://api.example.com/v1",
      AI_IMAGE_API_KEY: "test-key",
      AI_IMAGE_MODEL: "some-model",
    },
  });
  const b2 = cap2.body ?? {};
  console.log("case2 outcome ok:", r2.configured && r2.ok, "| size:", b2.size);

  // Case 3: diagnostics accept "none", reject garbage
  const d1 = diagnoseImageConfig({ AI_IMAGE_BASE_URL: "https://api.x.ai/v1", AI_IMAGE_API_KEY: "k", AI_IMAGE_MODEL: "m", AI_IMAGE_SIZE: "none" });
  const d2 = diagnoseImageConfig({ AI_IMAGE_BASE_URL: "https://api.x.ai/v1", AI_IMAGE_API_KEY: "k", AI_IMAGE_MODEL: "m", AI_IMAGE_SIZE: "huge" });
  console.log("diag none ok:", d1.length === 1 && d1[0].includes("well-formed"), "| diag garbage flagged:", d2.some((p) => p.includes("AI_IMAGE_SIZE")));

  // Case 4: parseImageConfig with none returns config with null size
  const c = parseImageConfig({ AI_IMAGE_BASE_URL: "https://api.x.ai/v1", AI_IMAGE_API_KEY: "k", AI_IMAGE_MODEL: "m", AI_IMAGE_SIZE: "none" });
  console.log("config parsed:", c !== null, "| size is null:", c?.size === null);
}

main().catch((e) => { console.error(e); process.exit(1); });
