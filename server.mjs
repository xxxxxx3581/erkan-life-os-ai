import "dotenv/config";
import express from "express";
import multer from "multer";
import { GoogleGenAI } from "@google/genai";
import fs from "node:fs";
import path from "node:path";

const app = express();
const port = process.env.PORT || 3000;

/* =========================================================
   CONFIG
========================================================= */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const AI_MODEL =
  process.env.GEMINI_MODEL ||
  "gemini-3-flash-preview";

const TTS_MODEL =
  process.env.GEMINI_TTS_MODEL ||
  "gemini-3.1-flash-tts-preview";

if (!GEMINI_API_KEY) {
  console.warn("GEMINI_API_KEY bulunamadi.");
}

const genai = new GoogleGenAI({
  apiKey: GEMINI_API_KEY
});

/* =========================================================
   EXPRESS
========================================================= */

app.use(
  express.json({
    limit: "1mb"
  })
);

/* =========================================================
   AUDIO UPLOAD
========================================================= */

const upload = multer({
  dest: "tmp/",
  limits: {
    fileSize: 15 * 1024 * 1024
  }
});

/* =========================================================
   AI SYSTEM
========================================================= */

const developer = `
Sen ERKAN LIFE OS'un kişisel dijital zekâsısın.

Türkçe konuş.

Doğal, anlaşılır, net ve faydalı cevaplar ver.

Sesli kullanım için gereksiz uzunlukta cevap verme.
Kullanıcı ayrıntı istemediyse doğrudan konuya gir.

Kullanıcı bir soru sorduğunda soruyu gerçekten cevapla.
Cevabı yarıda bırakma.

Fikir Laboratuvarı isteklerinde:
- problem
- hedef kullanıcı
- çözüm
- teknoloji
- MVP/prototip
- gelir modeli

açısından düşün.

Finans, sağlık veya hukuk gibi yüksek riskli konularda
kesin hüküm verme ve gerektiğinde profesyonel destek öner.

Kendini insan gibi tanıtma.
Gerektiğinde yapay zekâ asistanı olduğunu açıkça belirt.
`;

/* =========================================================
   HEALTH
========================================================= */

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "ERKAN LIFE OS",
    ai: Boolean(GEMINI_API_KEY),
    model: AI_MODEL,
    ttsModel: TTS_MODEL
  });
});

/* =========================================================
   CHAT
========================================================= */

app.post("/api/chat", async (req, res) => {
  const started = Date.now();

  try {
    const {
      message,
      history = [],
      mode = "assistant"
    } = req.body || {};

    if (!message || !String(message).trim()) {
      return res.status(400).json({
        error: "Mesaj boş olamaz."
      });
    }

    const safeHistory =
      Array.isArray(history)
        ? history
            .slice(-8)
            .map((item) => ({
              role:
                item.role === "assistant"
                  ? "model"
                  : "user",
              parts: [
                {
                  text: String(
                    item.content || ""
                  ).slice(0, 3000)
                }
              ]
            }))
        : [];

    const modeHint =
      {
        assistant:
          "Genel kişisel asistan gibi yardımcı ol.",

        idea:
          "Fikri ürünleştirme ve MVP açısından değerlendir.",

        today:
          "Günlük plan ve önceliklendirme konusunda yardımcı ol.",

        future:
          "Gelecek teknolojilerini ve olası senaryoları temkinli biçimde değerlendir."
      }[mode] ||
      "Genel kişisel asistan gibi yardımcı ol.";

    const contents = [
      ...safeHistory,
      {
        role: "user",
        parts: [
          {
            text: String(message).trim()
          }
        ]
      }
    ];

    console.log("AI başlatılıyor...");

    const response =
      await genai.models.generateContent({
        model: AI_MODEL,
        contents,
        config: {
          systemInstruction:
            developer +
            "\n\nMod: " +
            modeHint,

          temperature: 0.6,

          /*
           * Önceki 700 token yerine biraz daha düşük
           * tutuyoruz. Böylece normal sesli cevaplar
           * daha hızlı tamamlanır.
           */
          maxOutputTokens: 550
        }
      });

    const text =
      response.text ||
      "Yanıt üretilemedi.";

    console.log(
      "AI tamamlandı:",
      Date.now() - started,
      "ms"
    );

    return res.json({
      text,
      responseId:
        response.responseId || null
    });

  } catch (err) {

    console.error(
      "Gemini chat error:",
      err
    );

    return res.status(500).json({
      error:
        "AI bağlantısında bir sorun oluştu."
    });
  }
});

/* =========================================================
   PCM -> WAV
========================================================= */

function pcmToWav(
  pcmBuffer,
  sampleRate = 24000,
  channels = 1,
  bitsPerSample = 16
) {
  const header = Buffer.alloc(44);

  const byteRate =
    sampleRate *
    channels *
    bitsPerSample /
    8;

  const blockAlign =
    channels *
    bitsPerSample /
    8;

  header.write(
    "RIFF",
    0
  );

  header.writeUInt32LE(
    36 + pcmBuffer.length,
    4
  );

  header.write(
    "WAVE",
    8
  );

  header.write(
    "fmt ",
    12
  );

  header.writeUInt32LE(
    16,
    16
  );

  header.writeUInt16LE(
    1,
    20
  );

  header.writeUInt16LE(
    channels,
    22
  );

  header.writeUInt32LE(
    sampleRate,
    24
  );

  header.writeUInt32LE(
    byteRate,
    28
  );

  header.writeUInt16LE(
    blockAlign,
    32
  );

  header.writeUInt16LE(
    bitsPerSample,
    34
  );

  header.write(
    "data",
    36
  );

  header.writeUInt32LE(
    pcmBuffer.length,
    40
  );

  return Buffer.concat([
    header,
    pcmBuffer
  ]);
}

/* =========================================================
   TEXT TO SPEECH
========================================================= */

app.post(
  "/api/speech",
  async (req, res) => {

    const started = Date.now();

    try {

      const { text } =
        req.body || {};

      if (!text || !String(text).trim()) {
        return res.status(400).json({
          error:
            "Ses metni boş olamaz."
        });
      }

      if (!GEMINI_API_KEY) {
        return res.status(500).json({
          error:
            "GEMINI_API_KEY tanımlı değil."
        });
      }

      const cleanText =
        String(text)
          .trim()
          .slice(0, 5000);

      console.log(
        "TTS başlatılıyor:",
        TTS_MODEL
      );

      const response =
        await genai.models.generateContent({
          model: TTS_MODEL,

          contents: [
            {
              parts: [
                {
                  text:
                    "Türkçe konuş. " +
                    "Doğal, sıcak ve anlaşılır bir erkek anlatıcı gibi oku. " +
                    "Normal konuşma hızında konuş. " +
                    "Cümleler arasında doğal kısa duraklamalar bırak.\n\n" +
                    cleanText
                }
              ]
            }
          ],

          config: {
            responseModalities: [
              "AUDIO"
            ],

            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: "Kore"
                }
              }
            }
          }
        });

      const parts =
        response
          ?.candidates?.[0]
          ?.content?.parts || [];

      const audioPart =
        parts.find(
          (part) =>
            part?.inlineData?.data
        );

      if (!audioPart) {

        console.error(
          "TTS ses verisi bulunamadı."
        );

        throw new Error(
          "Gemini ses verisi döndürmedi."
        );
      }

      const pcmBuffer =
        Buffer.from(
          audioPart.inlineData.data,
          "base64"
        );

      if (!pcmBuffer.length) {
        throw new Error(
          "Gemini boş ses verisi döndürdü."
        );
      }

      const wavBuffer =
        pcmToWav(
          pcmBuffer,
          24000,
          1,
          16
        );

      console.log(
        "TTS tamamlandı:",
        Date.now() - started,
        "ms"
      );

      res.setHeader(
        "Content-Type",
        "audio/wav"
      );

      res.setHeader(
        "Content-Length",
        wavBuffer.length
      );

      return res.send(
        wavBuffer
      );

    } catch (err) {

      console.error(
        "Gemini TTS error:",
        err
      );

      return res.status(500).json({
        error:
          "Ses üretilemedi.",
        detail:
          process.env.NODE_ENV ===
          "production"
            ? undefined
            : String(
                err?.message || err
              )
      });
    }
  }
);

/* =========================================================
   TRANSCRIBE
   Küçük ses dosyasını doğrudan Gemini'ye gönderiyoruz.
   Böylece ayrıca Files API upload aşamasını kullanmıyoruz.
========================================================= */

app.post(
  "/api/transcribe",
  upload.single("audio"),
  async (req, res) => {

    let filePath;

    const started = Date.now();

    try {

      if (!req.file) {
        return res.status(400).json({
          error:
            "Ses dosyası gelmedi."
        });
      }

      if (!GEMINI_API_KEY) {
        return res.status(500).json({
          error:
            "GEMINI_API_KEY tanımlı değil."
        });
      }

      filePath =
        req.file.path;

      const mimeType =
        req.file.mimetype ||
        "audio/webm";

      const audioBase64 =
        await fs.promises.readFile(
          filePath,
          {
            encoding: "base64"
          }
        );

      console.log(
        "Transkripsiyon başlatılıyor..."
      );

      const response =
        await genai.models.generateContent({
          model: AI_MODEL,

          contents: [
            {
              parts: [
                {
                  text:
                    "Bu ses kaydındaki Türkçe konuşmayı " +
                    "yalnızca yazıya çevir. " +
                    "Açıklama, yorum veya ek metin yazma. " +
                    "Konuşulan cümleyi mümkün olduğunca doğru aktar."
                },
                {
                  inlineData: {
                    mimeType,
                    data: audioBase64
                  }
                }
              ]
            }
          ],

          config: {
            temperature: 0,
            maxOutputTokens: 300
          }
        });

      const text =
        response.text?.trim() || "";

      if (!text) {
        throw new Error(
          "Ses metne çevrilemedi."
        );
      }

      console.log(
        "Transkripsiyon tamamlandı:",
        Date.now() - started,
        "ms"
      );

      return res.json({
        text
      });

    } catch (err) {

      console.error(
        "Transcription error:",
        err
      );

      return res.status(500).json({
        error:
          "Ses çözümlenemedi."
      });

    } finally {

      if (filePath) {
        fs.promises
          .unlink(filePath)
          .catch(() => {});
      }
    }
  }
);

/* =========================================================
   FRONTEND
========================================================= */

app.get(
  "/{*splat}",
  (_req, res) => {

    res.sendFile(
      path.resolve(
        "index.html"
      )
    );
  }
);

/* =========================================================
   SERVER
========================================================= */

app.listen(
  port,
  () => {

    console.log(
      `ERKAN LIFE OS: http://localhost:${port}`
    );

    console.log(
      `AI Model: ${AI_MODEL}`
    );

    console.log(
      `TTS Model: ${TTS_MODEL}`
    );
  }
);
