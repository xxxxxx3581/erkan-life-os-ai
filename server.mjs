import "dotenv/config";
import express from "express";
import multer from "multer";
import { GoogleGenAI } from "@google/genai";
import fs from "node:fs";
import path from "node:path";

const app = express();
const port = process.env.PORT || 3000;

/* ---------------------------------------------------------
   CONFIG
--------------------------------------------------------- */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const AI_MODEL =
  process.env.GEMINI_MODEL ||
  "gemini-3-flash-preview";

const TTS_MODEL =
  process.env.GEMINI_TTS_MODEL ||
  "gemini-2.5-flash-preview-tts";

if (!GEMINI_API_KEY) {
  console.warn("GEMINI_API_KEY bulunamadi.");
}

const genai = new GoogleGenAI({
  apiKey: GEMINI_API_KEY
});

/* ---------------------------------------------------------
   EXPRESS
--------------------------------------------------------- */

app.use(
  express.json({
    limit: "1mb"
  })
);

/* ---------------------------------------------------------
   UPLOAD
--------------------------------------------------------- */

const upload = multer({
  dest: "tmp/",
  limits: {
    fileSize: 15 * 1024 * 1024
  }
});

/* ---------------------------------------------------------
   AI SYSTEM
--------------------------------------------------------- */

const developer = `
Sen ERKAN LIFE OS'un kişisel dijital zekâsısın.

Türkçe konuş.

Kibar, doğal, anlaşılır, kısa ama faydalı cevaplar ver.

Gereksiz uzun listeler verme.

Kullanıcının amacını anlamaya çalış ve uygulanabilir
cevaplar üret.

Fikir Laboratuvarı isteklerinde:

- problem
- hedef kullanıcı
- çözüm
- teknoloji
- MVP/prototip
- sürdürülebilir gelir modeli

açısından düşün.

Finans, sağlık veya hukuk gibi yüksek riskli konularda
kesin hüküm verme ve gerektiğinde profesyonel destek öner.

Kendini insan gibi tanıtma.

Gerektiğinde bir yapay zekâ asistanı olduğunu açıkça belirt.
`;

/* ---------------------------------------------------------
   HEALTH
--------------------------------------------------------- */

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "ERKAN LIFE OS",
    ai: Boolean(GEMINI_API_KEY),
    model: AI_MODEL,
    ttsModel: TTS_MODEL
  });
});

/* ---------------------------------------------------------
   CHAT
--------------------------------------------------------- */

app.post("/api/chat", async (req, res) => {
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
            .slice(-12)
            .map((item) => ({
              role:
                item.role === "assistant"
                  ? "model"
                  : "user",
              parts: [
                {
                  text: String(
                    item.content || ""
                  ).slice(0, 4000)
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

    const response =
      await genai.models.generateContent({
        model: AI_MODEL,
        contents,
        config: {
          systemInstruction:
            developer +
            "\n\nMod: " +
            modeHint,

          temperature: 0.7,

          maxOutputTokens: 700
        }
      });

    const text =
      response.text ||
      "Yanıt üretilemedi.";

    res.json({
      text,
      responseId:
        response.responseId || null
    });

  } catch (err) {

    console.error(
      "Gemini chat error:",
      err
    );

    res.status(500).json({
      error:
        "AI bağlantısında bir sorun oluştu."
    });
  }
});

/* ---------------------------------------------------------
   PCM -> WAV
--------------------------------------------------------- */

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

/* ---------------------------------------------------------
   TEXT TO SPEECH
--------------------------------------------------------- */

app.post(
  "/api/speech",
  async (req, res) => {

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
                    "Türkçe olarak doğal, sıcak, anlaşılır ve akıcı bir erkek anlatıcı gibi oku. " +
                    "Normal konuşma hızında konuş. " +
                    "Cümleler arasında doğal kısa duraklamalar bırak.\n\n" +
                    String(text)
                      .trim()
                      .slice(0, 4096)
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

      console.log(
        "TTS Gemini yanıtı alındı."
      );

      const parts =
        response
          ?.candidates?.[0]
          ?.content
          ?.parts || [];

      const audioPart =
        parts.find(
          (part) =>
            part?.inlineData?.data
        );

      if (!audioPart) {

        console.error(
          "TTS audio part bulunamadı:",
          JSON.stringify(
            response,
            null,
            2
          )
        );

        throw new Error(
          "Gemini ses verisi döndürmedi."
        );
      }

      const base64Audio =
        audioPart.inlineData.data;

      const pcmBuffer =
        Buffer.from(
          base64Audio,
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
        "TTS başarılı:",
        wavBuffer.length,
        "bytes"
      );

      res.setHeader(
        "Content-Type",
        "audio/wav"
      );

      res.setHeader(
        "Content-Length",
        wavBuffer.length
      );

      res.send(
        wavBuffer
      );

    } catch (err) {

      console.error(
        "Gemini TTS error:"
      );

      console.error(
        err
      );

      res.status(500).json({
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

/* ---------------------------------------------------------
   TRANSCRIBE — MİKROFON
--------------------------------------------------------- */

app.post(
  "/api/transcribe",
  upload.single("audio"),
  async (req, res) => {

    let filePath;

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

      console.log(
        "Mikrofon kaydı alındı:",
        req.file.size,
        "bytes",
        mimeType
      );

      /*
       * Küçük ses dosyasını doğrudan
       * Gemini'ye inline audio olarak gönderiyoruz.
       */

      const audioBase64 =
        await fs.promises.readFile(
          filePath,
          {
            encoding: "base64"
          }
        );

      const response =
        await genai.models.generateContent({
          model: AI_MODEL,

          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `
Bu bir Türkçe mikrofon kaydıdır.

Konuşmayı mümkün olduğunca doğru şekilde
Türkçe metne çevir.

Sadece konuşulan metni yaz.
Açıklama ekleme.
"İşte transkript" gibi giriş yapma.
Konuşmada duyulmayan kelimeleri uydurma.
`
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
            temperature: 0.1,

            maxOutputTokens: 500
          }
        });

      const text =
        response.text?.trim();

      if (!text) {
        throw new Error(
          "Gemini ses kaydından metin çıkaramadı."
        );
      }

      console.log(
        "Transkripsiyon başarılı:",
        text
      );

      return res.json({
        text
      });

    } catch (err) {

      console.error(
        "Gemini transcription error:"
      );

      console.error(
        err
      );

      return res.status(500).json({
        error:
          "Ses çözümlenemedi.",
        detail:
          process.env.NODE_ENV ===
          "production"
            ? undefined
            : String(
                err?.message || err
              )
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

/* ---------------------------------------------------------
   FRONTEND
--------------------------------------------------------- */

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

/* ---------------------------------------------------------
   SERVER
--------------------------------------------------------- */

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
