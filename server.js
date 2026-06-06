import Anthropic from "@anthropic-ai/sdk";
import express from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const client = new Anthropic();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

app.use(express.static(path.join(__dirname, "public")));

const SYSTEM_PROMPT = `You are writing offer messages on behalf of GraySparks Ltd, a professional fencing and garden structures company based in London.

A customer lead screenshot will be shown to you. Extract all relevant details and write a short, warm, professional offer message ready to send on the platform.

Rules:
- Address the customer by first name only
- Reference their specific job, dimensions, and location naturally
- Mention we cover their area and are happy to help
- Offer a free no-obligation visit/quote
- If they mentioned Supply & Install or Install Only, acknowledge we can do either
- Keep it to 4–6 sentences — concise and confident, not pushy
- Do NOT include a price
- Sign off: GraySparks Ltd
- No emojis, no "Dear", start with "Hi [Name],"
- Output ONLY the message — no preamble, no explanation`;

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

  try {
    const message = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            ...imageContent,
            {
              type: "text",
              text: "Write the offer message for this lead.",
            },
          ],
        },
      ],
    });

    const text = message.content[0].type === "text" ? message.content[0].text.trim() : "";
    res.json({ message: text });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to generate message. Check your ANTHROPIC_API_KEY." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`GraySparks Offer Generator running at http://localhost:${PORT}`);
});
