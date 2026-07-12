import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import "dotenv/config";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase payload limit for base64 images
  app.use(express.json({ limit: "10mb" }));

  app.post("/api/analyze", async (req, res) => {
    try {
      const { imageBase64, mimeType } = req.body;
      
      if (!imageBase64 || !mimeType) {
        return res.status(400).json({ error: "Image data is required" });
      }

      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [
          {
            text: "You are a botanist. Analyze this plant's health. Identify the plant (common and scientific name), state its current health status, any diseases or issues visible, actionable recommendations, its ideal growing conditions, and general care tips."
          },
          {
            inlineData: {
              data: imageBase64,
              mimeType: mimeType,
            }
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              plantName: {
                type: Type.STRING,
                description: "The common name of the plant."
              },
              scientificName: {
                type: Type.STRING,
                description: "The scientific name of the plant."
              },
              healthStatus: {
                type: Type.STRING,
                description: "The health status of the plant.",
                enum: ["Healthy", "Needs Attention", "Sick", "Unknown"]
              },
              issues: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Any diseases, pests, or issues visible."
              },
              recommendations: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Actionable recommendations for the user to improve or maintain the plant's health."
              },
              growingConditions: {
                type: Type.OBJECT,
                properties: {
                  light: { type: Type.STRING, description: "Ideal lighting conditions." },
                  water: { type: Type.STRING, description: "Ideal watering schedule/needs." },
                  soil: { type: Type.STRING, description: "Ideal soil composition." }
                },
                required: ["light", "water", "soil"]
              },
              careTips: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "General care tips for this plant species."
              }
            },
            required: ["plantName", "healthStatus", "issues", "recommendations"]
          }
        }
      });

      const text = response.text;
      if (!text) {
        throw new Error("No text response from Gemini");
      }
      
      const result = JSON.parse(text);
      res.json(result);
    } catch (error: any) {
      console.error("Error analyzing image:", error);
      res.status(500).json({ error: error.message || "Failed to analyze image" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
