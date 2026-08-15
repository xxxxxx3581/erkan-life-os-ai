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
   UPLOAD
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

Sesli kullanım için gereksiz uzun cevaplar verme.
Kullanıcı ayrıntı istemediyse doğrudan konuya gir.

Kullanıcının sorusunu gerçekten cevapla.
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
    ttsModel: TTS_MODEL,
    streamingTTS: true
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
   PCM -> WAV HEADER
========================================================= */

function createWavHeader(
  dataLength,
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
    36 + dataLength,
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
    dataLength,
    40
  );

  return header;
}

/* =========================================================
   TEXT TO SPEECH - STREAMING
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
        "TTS STREAM başlatılıyor:",
        TTS_MODEL
      );

      /*
       * Gemini 3.1 Flash TTS streaming.
       *
       * Model PCM ses parçalarını üretirken
       * stream üzerinden gönderir.
       */

      const stream =
        await genai.interactions.create({
          model: TTS_MODEL,

          input:
            "Türkçe konuş. " +
            "Doğal, sıcak, anlaşılır ve akıcı bir erkek anlatıcı gibi oku. " +
            "Normal konuşma hızında konuş. " +
            "Cümleler arasında doğal kısa duraklamalar bırak.\n\n" +
            cleanText,

          response_format: {
            type: "audio"
          },

          generation_config: {
            speech_config: [
              {
                voice: "Kore"
              }
            ]
          },

          stream: true
        });

      /*
       * Tarayıcıya PCM akışı göndereceğiz.
       *
       * Not:
       * WAV başlığını toplam uzunluk bilinmediği için
       * burada önceden yazmıyoruz.
       *
       * index.html tarafında gelen PCM parçaları
       * AudioContext ile oynatılacak.
       */

      res.statusCode = 200;

      res.setHeader(
        "Content-Type",
        "application/octet-stream"
      );

      res.setHeader(
        "X-Audio-Format",
        "pcm_s16le"
      );

      res.setHeader(
        "X-Audio-Sample-Rate",
        "24000"
      );

      res.setHeader(
        "X-Audio-Channels",
        "1"
      );

      res.setHeader(
        "X-Audio-Bit-Depth",
        "16"
      );

      res.setHeader(
        "Cache-Control",
        "no-cache, no-store, must-revalidate"
      );

      res.setHeader(
        "X-Accel-Buffering",
        "no"
      );

      /*
       * Stream içindeki her audio delta'yı
       * doğrudan response'a yazıyoruz.
       */

      let totalBytes = 0;
      let firstAudio = true;

      for await (const event of stream) {

        if (
          event?.event_type !==
          "step.delta"
        ) {
          continue;
        }

        const delta =
          event?.delta;

        if (
          !delta ||
          delta.type !== "audio" ||
          !delta.data
        ) {
          continue;
        }

        const audioBuffer =
          Buffer.from(
            delta.data,
            "base64"
          );

        if (!audioBuffer.length) {
          continue;
        }

        if (firstAudio) {

          firstAudio = false;

          console.log(
            "İlk TTS ses parçası:",
            Date.now() - started,
            "ms"
          );
        }

        totalBytes +=
          audioBuffer.length;

        if (!res.destroyed) {
          res.write(
            audioBuffer
          );
        }
      }

      console.log(
        "TTS STREAM tamamlandı:",
        totalBytes,
        "bytes /",
        Date.now() - started,
        "ms"
      );

      if (!res.destroyed) {
        res.end();
      }

    } catch (err) {

      console.error(
        "Gemini TTS STREAM error:",
        err
      );

      /*
       * Eğer response henüz başlamadıysa
       * JSON hata mesajı döndür.
       */

      if (!res.headersSent) {

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

      /*
       * Stream başladıktan sonra hata oluşursa
       * bağlantıyı kapatıyoruz.
       */

      if (!res.destroyed) {
        res.destroy();
      }
    }
  }
);

/* =========================================================
   TRANSCRIBE
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
                    "Açıklama veya yorum ekleme."
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

    console.log(
      "TTS Streaming: AKTIF"
    );
  }
);
