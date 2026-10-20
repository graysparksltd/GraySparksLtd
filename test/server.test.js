import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server.js";

const GOOD = "Hi, I have built fitted units like this before and can look at the wall plan with you.";
const BAD = "Hi, I charge £50 per hour – it is a great price.";

// A fake Anthropic client: replies with the given texts in order and records every request.
function fakeClient(replies) {
  const calls = [];
  return {
    calls,
    messages: {
      create: async (req) => {
        calls.push(structuredClone(req));
        const text = replies[Math.min(calls.length - 1, replies.length - 1)];
        return { content: [{ type: "text", text }] };
      },
    },
  };
}

async function post(client, withFile = true) {
  const server = createApp(client).listen(0);
  try {
    const form = new FormData();
    if (withFile) form.append("screenshots", new Blob([Buffer.from("png")], { type: "image/png" }), "a.png");
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/generate`, { method: "POST", body: form });
    return { status: res.status, body: await res.json() };
  } finally {
    server.close();
  }
}

test("a clean draft is returned after one call", async () => {
  const client = fakeClient([GOOD]);
  const { status, body } = await post(client);
  assert.equal(status, 200);
  assert.equal(body.message, GOOD);
  assert.deepEqual(body.compliance, { passed: true, issues: [] });
  assert.equal(client.calls.length, 1);
});

test("a draft that breaks the rules is retried once with the problems listed", async () => {
  const client = fakeClient([BAD, GOOD]);
  const { body } = await post(client);
  assert.equal(client.calls.length, 2);
  assert.equal(body.message, GOOD);
  assert.equal(body.compliance.passed, true);
  const retry = client.calls[1].messages;
  assert.equal(retry[1].role, "assistant");
  assert.match(retry[2].content, /dash/);
  assert.match(retry[2].content, /price/);
});

test("a draft that still fails after the retry is flagged, not hidden", async () => {
  const client = fakeClient([BAD, BAD]);
  const { body } = await post(client);
  assert.equal(client.calls.length, 2);
  assert.equal(body.compliance.passed, false);
  assert.ok(body.compliance.issues.length > 0);
  assert.equal(body.message, BAD);
});

test("no screenshot is a 400 and makes no API call", async () => {
  const client = fakeClient([GOOD]);
  const { status } = await post(client, false);
  assert.equal(status, 400);
  assert.equal(client.calls.length, 0);
});

test("an API failure is a 500 with a safe message", async () => {
  const client = { messages: { create: async () => { throw new Error("secret detail"); } } };
  const { status, body } = await post(client);
  assert.equal(status, 500);
  assert.doesNotMatch(JSON.stringify(body), /secret detail/);
});
