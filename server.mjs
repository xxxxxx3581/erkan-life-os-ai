import "dotenv/config";
import express from "express";
import multer from "multer";
import OpenAI from "openai";
import fs from "node:fs";
import path from "node:path";

const app = express();
const port = process.env.PORT || 3000;
const upload = multer({ dest: "tmp/", limits: { fileSize: 15 * 1024 * 1024 } });

if (!process.env.OPENAI_API_KEY) {
  console.warn("OPENAI_API_KEY bulunamadi. .env dosyasina eklemelisin.");
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const AI_MODEL = process.env.OPENAI_MODEL || "gpt-5";

app.use(express.json({ limit: "1mb" }));

const developer = `
Sen ERKAN LIFE OS'un kişisel dijital zekâsısın.
Türkçe konuş. Kibar, doğal, kısa ama faydalı cevaplar ver.
Kullanıcıya gereksiz uzun listeler verme.
Görevleri önceliklendirirken uygulanabilir ve gerçekçi ol.
Fikir Laboratuvarı isteklerinde: problem, hedef kullanıcı, çözüm, teknoloji,
MVP/prototip ve sürdürülebilir gelir modeli başlıklarını düşün.
Finans, sağlık veya hukuk gibi yüksek riskli konularda kesin hüküm verme;
gerektiğinde profesyonel destek öner.
Kendini insan gibi tanıtma; bir yapay zekâ asistanı olduğunu gerektiğinde açıkça belirt.
`;

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "ERKAN LIFE OS", ai: Boolean(process.env.OPENAI_API_KEY) });
});

app.post("/api/chat", async (req, res) => {
  try {
    const { message, history = [], mode = "assistant" } = req.body || {};
    if (!message?.trim()) return res.status(400).json({ error: "Mesaj boş olamaz." });

    const safeHistory = Array.isArray(history)
      ? history.slice(-12).map(x => ({
          role: x.role === "assistant" ? "assistant" : "user",
          content: String(x.content || "").slice(0, 4000)
        }))
      : [];

    const modeHint = {
      assistant: "Genel kişisel asistan gibi yardımcı ol.",
      idea: "Fikri ürünleştirme ve MVP açısından değerlendir.",
      today: "Günlük plan ve önceliklendirme konusunda yardımcı ol.",
      future: "Gelecek teknolojileri ve olası senaryoları temkinli biçimde değerlendir."
    }[mode] || "Genel kişisel asistan gibi yardımcı ol.";

    const response = await openai.responses.create({
      model: AI_MODEL,
      reasoning: { effort: "medium" },
      instructions: developer + "\nMod: " + modeHint,
      input: [...safeHistory, { role: "user", content: message.trim() }],
      max_output_tokens: 700
    });

    res.json({ text: response.output_text || "Yanıt üretilemedi.", responseId: response.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "AI bağlantısında bir sorun oluştu." });
  }
});

app.post("/api/speech", async (req, res) => {
  try {
    const { text } = req.body || {};
    if (!text?.trim()) return res.status(400).json({ error: "Ses metni boş olamaz." });

    const audio = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: "marin",
      input: text.trim().slice(0, 4096),
      instructions: "Türkçe konuş. Kibar, sıcak, doğal, akıcı ve hafif enerjik bir erkek anlatıcı gibi konuş. Çok yavaşlama; cümleler arasında kısa ve doğal duraklar bırak.",
      speed: 1.12,
      response_format: "mp3"
    });

    const buffer = Buffer.from(await audio.arrayBuffer());
    res.setHeader("Content-Type", "audio/mpeg");
    res.send(buffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ses üretilemedi." });
  }
});

app.post("/api/transcribe", upload.single("audio"), async (req, res) => {
  let filePath;
  try {
    if (!req.file) return res.status(400).json({ error: "Ses dosyası gelmedi." });
    filePath = req.file.path;

    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: "gpt-4o-transcribe",
      language: "tr"
    });

    res.json({ text: transcription.text || "" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ses çözümlenemedi." });
  } finally {
    if (filePath) fs.promises.unlink(filePath).catch(() => {});
  }
});

app.get("/{*splat}, (_req, res) => {
  res.sendFile(path.resolve("index.html"));
});

app.listen(port, () => {
  console.log(`ERKAN LIFE OS: http://localhost:${port}`);
});
