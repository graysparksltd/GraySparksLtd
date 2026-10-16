import test from "node:test";
import assert from "node:assert/strict";
import { checkDraft, MAX_LENGTH } from "../compliance.js";

const GOOD = "Thanks for the clear brief. A 2.4m stud wall with a door opening is a straightforward job, and I've done a fair few of these. I'd want to check the floor and ceiling fixings, and whether you'd like the plasterboard skimmed or left ready for paint. A quick chat or a visit to measure up would let us confirm everything. I can start next week, and I'm happy to look at it whenever suits.";

const names = (text) => checkDraft(text).map((p) => p.split(":")[0]);

test("a clean draft passes", () => {
  assert.deepEqual(checkDraft(GOOD), []);
});

test("empty draft is flagged", () => {
  assert.deepEqual(checkDraft(""), ["empty draft"]);
  assert.deepEqual(checkDraft(undefined), ["empty draft"]);
});

test("length limit is 1500 characters", () => {
  assert.deepEqual(checkDraft("a".repeat(MAX_LENGTH - 1)), []);
  assert.ok(names("a".repeat(MAX_LENGTH)).some((n) => n.startsWith("too long")));
});

const BAD = [
  ["dash", "Happy to help \u2014 any time."],
  ["dash", "4\u20136 days."],
  ["link", "See https://example.com for details."],
  ["link", "Look at www.graysparks.ltd"],
  ["email", "Mail me on a.b@example.com"],
  ["phone", "Ring 07966 929394 to talk."],
  ["price", "It would be \u00a3450 all in."],
  ["price", "My hourly rate is fair."],
  ["price", "About 40 per hour."],
  ["budget", "Your budget looks workable."],
  ["salesy", "I offer a free quote."],
  ["salesy", "A no-obligation chat."],
  ["salesy", "A free measure first."],
  ["off-platform", "Message me on WhatsApp."],
  ["grading", "You're right that the studs need doubling."],
  ["grading", "You've clearly thought about this."],
  ["self-certify", "That's my strength."],
  ["self-certify", "I'm genuinely good at this."],
  ["rather-than", "Finished properly rather than patched."],
  ["rivals", "Anyone pricing that blind is guessing."],
];

for (const [rule, text] of BAD) {
  test(`flags ${rule}: ${text}`, () => {
    assert.ok(names(text).includes(rule), `expected ${rule}, got ${names(text)}`);
  });
}
