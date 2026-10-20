import Anthropic from "@anthropic-ai/sdk";
import express from "express";
import multer from "multer";
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { checkDraft } from "./compliance.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// One copy of the drafting rules: CLAUDE.md is the source of truth.
const RULES = readFileSync(path.join(__dirname, "CLAUDE.md"), "utf8");

const SYSTEM_PROMPT = `${RULES}

The task details arrive as one or more screenshots of the Airtasker task and any competing comments. Read them, then follow the rules above exactly. Output only the offer message.`;

const textOf = (message) =>
  message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();

// The client is a parameter so tests can pass a fake and never call the live API.
export function createApp(client = new Anthropic()) {
  const app = express();
  app.use(express.static(path.join(__dirname, "public")));

  app.post("/api/generate", upload.array("screenshots", 5), async (req, res) => {
    const files = req.files;
    if (!files || files.length === 0) {
      return res.status(400).json({ error: "Please upload at least one screenshot." });
    }

    const imageContent = files.map((file) => ({
      type: "image",
      source: {
        type: "base64",
        media_type: file.mimetype,
        data: file.buffer.toString("base64"),
      },
    }));
    const messages = [
      {
        role: "user",
        content: [...imageContent, { type: "text", text: "Write the offer message for this lead." }],
      },
    ];
    const ask = () => client.messages.create({ model: "claude-opus-5-5", max_tokens: 1024, system: SYSTEM_PROMPT, messages });

    try {
      let text = textOf(await ask());
      let issues = checkDraft(text);
      if (issues.length > 0) {
        // One retry, telling the model what failed. If it still fails the draft is flagged, never hidden.
        messages.push(
          { role: "assistant", content: text || "(empty)" },
          { role: "user", content: `That draft broke these rules: ${issues.join("; ")}. Rewrite it so it follows every rule. Output only the offer message.` }
        );
        text = textOf(await ask());
        issues = checkDraft(text);
      }
      res.json({
        message: text,
        compliance: {
          passed: issues.length === 0,
          issues,
        },
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to generate message. Check your ANTHROPIC_API_KEY." });
    }
  });

  return app;
}

// Only listen when run directly (npm start), not when a test imports createApp.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const PORT = process.env.PORT || 3000;
  createApp().listen(PORT, () => {
    console.log(`GraySparks Offer Generator running at http://localhost:${PORT}`);
  });
}
