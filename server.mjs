import "dotenv/config";
import express from "express";
import multer from "multer";
import { GoogleGenAI } from "@google/genai";
import fs from "node:fs";
import path from "node:path";

const app = express();
const port = process.env.PORT || 3000;
const upload = multer({
  dest: "tmp/",
  limits: { fileSize: 15 * 1024 * 1024 }
});

const genai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

const AI_MODEL = process.env.GEMINI_MODEL || "gemini-3-flash-preview";

app.use(express.json({ limit: "1mb" }));

const developer = `
Sen ERKAN LIFE OS'un kişisel dijital zekâsısın.
Türkçe konuş. Kibar, doğal, kısa ama faydalı cevaplar ver.
Kullanıcıya gereksiz uzun listeler verme.
Görevleri önceliklendirirken uygulanabilir ve gerçekçi ol.
Fikir Laboratuvarı isteklerinde problem, hedef kullanıcı, çözüm,
teknoloji, MVP/prototip ve sürdürülebilir gelir modeli başlıklarını düşün.
Finans, sağlık veya hukuk gibi yüksek riskli konularda kesin hüküm verme;
gerektiğinde profesyonel destek öner.
Kendini insan gibi tanıtma; bir yapay zekâ asistanı olduğunu gerektiğinde açıkça belirt.
`;

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "ERKAN LIFE OS",
    ai: Boolean(process.env.GEMINI_API_KEY)
  });
});

app.post("/api/chat", async (req, res) => {
  try {
    const {
      message,
      history = [],
      mode = "assistant"
    } = req.body || {};

    if (!message?.trim()) {
      return res.status(400).json({
        error: "Mesaj boş olamaz."
      });
    }

    const safeHistory = Array.isArray(history)
      ? history.slice(-12).map(x => ({
          role: x.role === "assistant" ? "model" : "user",
          parts: [{ text: String(x.content || "").slice(0, 4000) }]
        }))
      : [];

    const modeHint = {
      assistant: "Genel kişisel asistan gibi yardımcı ol.",
      idea: "Fikri ürünleştirme ve MVP açısından değerlendir.",
      today: "Günlük plan ve önceliklendirme konusunda yardımcı ol.",
      future: "Gelecek teknolojileri ve olası senaryoları temkinli biçimde değerlendir."
    }[mode] || "Genel kişisel asistan gibi yardımcı ol.";

    const contents = [
      ...safeHistory,
      {
        role: "user",
        parts: [{
          text: message.trim()
        }]
      }
    ];

    const response = await genai.models.generateContent({
      model: AI_MODEL,
      contents,
      config: {
        systemInstruction: developer + "\nMod: " + modeHint,
        temperature: 0.7,
        maxOutputTokens: 700
      }
    });

    const text = response.text || "Yanıt üretilemedi.";

    res.json({
      text,
      responseId: response.responseId || null
    });

  } catch (err) {
    console.error("Gemini chat error:", err);

    res.status(500).json({
      error: "AI bağlantısında bir sorun oluştu."
    });
  }
});

/*
 * Şimdilik ses bölümlerini Gemini'ye çevirmiyoruz.
 * Önce yazılı AI bağlantısını çalıştırıyoruz.
 * Böylece hatanın nereden geldiğini net olarak görebiliriz.
 */

app.post("/api/speech", async (_req, res) => {
  res.status(501).json({
    error: "Ses özelliği bir sonraki aşamada etkinleştirilecek."
  });
});

app.post("/api/transcribe", upload.single("audio"), async (req, res) => {
  let filePath;

  try {
    if (!req.file) {
      return res.status(400).json({
        error: "Ses dosyası gelmedi."
      });
    }

    filePath = req.file.path;

    return res.status(501).json({
      error: "Mikrofon özelliği bir sonraki aşamada etkinleştirilecek."
    });

  } catch (err) {
    console.error("Transcription error:", err);

    res.status(500).json({
      error: "Ses çözümlenemedi."
    });

  } finally {
    if (filePath) {
      fs.promises.unlink(filePath).catch(() => {});
    }
  }
});

app.get("/{*splat}", (_req, res) => {
  res.sendFile(path.resolve("index.html"));
});

app.listen(port, () => {
  console.log(`ERKAN LIFE OS: http://localhost:${port}`);
});
