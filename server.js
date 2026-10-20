import Anthropic from "@anthropic-ai/sdk";
import express from "express";
import multer, { MulterError } from "multer";
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { checkDraft } from "./compliance.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MAX_FILE_MB = 10;
const MAX_FILES = 5;
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_MB * 1024 * 1024, files: MAX_FILES },
  fileFilter: (req, file, cb) => {
    if (IMAGE_TYPES.includes(file.mimetype)) return cb(null, true);
    cb(new MulterError("LIMIT_UNEXPECTED_FILE", "type"));
  },
});

// Plain-English messages for upload problems, so the page never shows an HTML error.
function uploadMessage(err) {
  if (err.code === "LIMIT_FILE_SIZE") return `A screenshot is over ${MAX_FILE_MB} MB. Use a smaller image.`;
  if (err.code === "LIMIT_FILE_COUNT") return `Upload at most ${MAX_FILES} screenshots.`;
  if (err.code === "LIMIT_UNEXPECTED_FILE" && err.field === "type") return "Only PNG, JPEG, GIF or WebP screenshots can be used.";
  if (err.code === "LIMIT_UNEXPECTED_FILE") return `Upload at most ${MAX_FILES} screenshots, using the screenshots field.`;
  return "The upload could not be read. Please try again.";
}

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

  app.post("/api/generate", upload.array("screenshots", MAX_FILES), async (req, res) => {
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

  app.use((err, req, res, next) => {
    if (err instanceof MulterError) return res.status(err.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({ error: uploadMessage(err) });
    next(err);
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
