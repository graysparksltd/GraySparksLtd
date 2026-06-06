import Anthropic from "@anthropic-ai/sdk";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const client = new Anthropic();

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const SYSTEM_PROMPT = `You are a skilled sales assistant for GraySparks Ltd, a professional fencing and garden structures company based in London.

Your job is to write a tailored, friendly and professional offer message in response to a customer lead from a contractor marketplace (like Rated People, MyBuilder, or Checkatrade).

Guidelines:
- Address the customer by first name
- Reference their specific job requirements and dimensions if provided
- Mention that we cover their area
- Express genuine interest in the project
- Offer to visit for a free no-obligation quote/survey
- Mention we can do both Supply & Install or Install Only (if the customer mentioned it as an option)
- Keep the tone warm, confident, and professional — not pushy
- Keep it concise: 4-6 sentences max
- Do NOT include a price estimate unless a budget was explicitly mentioned and only to acknowledge it
- End with a clear call to action (e.g. "Happy to pop over for a free measure and quote")
- Do NOT use greetings like "Dear" — start naturally e.g. "Hi [Name],"
- Sign off as "GraySparks Ltd" on a new line at the end
- Do not use emojis
- Do not repeat the customer's full address back to them verbatim`;

app.post("/api/generate", async (req, res) => {
  const { customerName, location, budget, timeline, description, dimensions, jobType } = req.body;

  if (!description) {
    return res.status(400).json({ error: "Job description is required" });
  }

  const leadSummary = [
    customerName && `Customer name: ${customerName}`,
    location && `Location: ${location}`,
    budget && `Customer budget: £${budget}`,
    timeline && `Timeline: ${timeline}`,
    dimensions && `Dimensions/measurements: ${dimensions}`,
    jobType && `Job type preference: ${jobType}`,
    `Job description: ${description}`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const message = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Please write a tailored offer message for this lead:\n\n${leadSummary}`,
        },
      ],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";
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
