
import { GoogleGenAI, Type } from "@google/genai";
import { DetectedElement } from "../types";
import { getRuntimeKey } from "./keyStore";

const BUILD_API_KEY = process.env.API_KEY || "";

/**
 * The session key pasted into the in-app key box (hosted usage) wins;
 * otherwise the build-time key from `.env.local` (offline usage) is used.
 */
export const getActiveApiKey = (): string => getRuntimeKey() || BUILD_API_KEY;

export const isKeyConfigured = (): boolean => Boolean(getActiveApiKey());

/**
 * Throws a friendly, actionable error when no API key is available at all.
 */
const assertApiKey = () => {
  if (!isKeyConfigured()) {
    throw new Error(
      "Gemini API key is not configured. Offline: add GEMINI_API_KEY=your_key to .env.local and restart. Hosted: paste a session key in the key card at the top of the page."
    );
  }
};

/**
 * data:image/png;base64,XXXX -> { mimeType, base64 }
 * Lets the AI see the true image format (jpeg/webp/png) instead of assuming PNG.
 */
const splitDataUrl = (dataUrl: string): { mimeType: string; base64: string } => {
  const [meta = '', data = ''] = dataUrl.split(',');
  const mimeType = /data:(image\/[a-z0-9.+-]+);?/i.exec(meta)?.[1] || 'image/png';
  return { mimeType, base64: data };
};

const imagePart = (dataUrl: string) => {
  const { mimeType, base64 } = splitDataUrl(dataUrl);
  return { inlineData: { mimeType, data: base64 } };
};

/**
 * Translates generic API errors into user-friendly messages.
 */
const translateError = (error: any): string => {
  const msg = error?.message || String(error);

  if (/API key not valid|API_KEY_INVALID/i.test(msg)) {
    return "Your Gemini API key is invalid or was deleted. Offline: replace GEMINI_API_KEY in .env.local. Hosted: press \"Erase key\" and paste a fresh key from https://aistudio.google.com/apikey, then retry.";
  }
  if (msg.includes("429")) {
    return "Rate limit exceeded. Too many people are using the AI right now. Please wait 10-20 seconds and try again.";
  }
  if (msg.includes("403")) {
    return "Permission denied. Please ensure your API key is correctly configured and has access to the Gemini models.";
  }
  if (msg.includes("400")) {
    return "Invalid request. The image might be too large, corrupted, or in an unsupported format.";
  }
  if (msg.includes("500") || msg.includes("503") || msg.includes("overloaded")) {
    return "Google's AI servers are temporarily overloaded. Please try again in a few moments.";
  }
  if (msg.includes("SAFETY") || msg.includes("finishReason: SAFETY")) {
    return "This request was blocked by safety filters. Ensure your image and instructions follow community guidelines.";
  }
  if (msg.includes("RECITATION")) {
    return "The model produced content that matched copyrighted material. Please try a slightly different instruction.";
  }

  return `Error: ${msg.length > 100 ? msg.substring(0, 100) + "..." : msg}`;
};

export const analyzeImage = async (dataUrl: string): Promise<DetectedElement[]> => {
  assertApiKey();
  const ai = new GoogleGenAI({ apiKey: getActiveApiKey() });

  const prompt = `Analyze this YouTube gaming thumbnail. Identify all visible major elements like characters, players, mobs, text overlays, specific weapons/tools, background elements, UI elements, and logos.
  Return the list of detected elements in a structured JSON format. 
  Each element must have a 'name' (descriptive) and a 'type' (one of: 'character', 'object', 'background', 'text', 'mob', 'ui', 'logo').`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          imagePart(dataUrl),
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            detected_elements: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  type: { type: Type.STRING }
                },
                required: ["name", "type"]
              }
            }
          }
        }
      }
    });

    if (!response.text) {
      throw new Error("The model returned an empty analysis result.");
    }

    const json = JSON.parse(response.text);
    return json.detected_elements || [];
  } catch (e: any) {
    console.error("Analysis failure:", e);
    throw new Error(translateError(e));
  }
};

export const editThumbnail = async (
  dataUrl: string,
  instruction: string,
  replacementDataUrl?: string
): Promise<string> => {
  assertApiKey();
  const ai = new GoogleGenAI({ apiKey: getActiveApiKey() });

  let prompt = `You are a professional AI image editor specialized in YouTube gaming thumbnails.
  ACTION: ${instruction}
  
  CONSTRAINTS:
  - Maintain the 16:9 aspect ratio perfectly.
  - Inpaint the background realistically behind removed elements.
  - Preserve lighting, shadows, and cinematic gaming aesthetic.
  - Upscale output to high quality (1920x1080 resolution).
  - Do not add new hallucinated objects.
  - Keep the image sharp and clear.`;

  if (replacementDataUrl) {
    prompt += `\n\nREPLACEMENT TASK: Use the second provided image (the replacement object/person) to replace the specified area or object in the first image. Ensure the replacement blends naturally with the lighting and perspective of the original thumbnail.`;
  }

  try {
    const parts: any[] = [imagePart(dataUrl)];

    if (replacementDataUrl) {
      parts.push(imagePart(replacementDataUrl));
    }

    parts.push({ text: prompt });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: parts
      },
      config: {
        imageConfig: {
          aspectRatio: "16:9",
          imageSize: "1K"
        }
      }
    });

    if (!response.candidates?.[0]?.content?.parts) {
      if (response.candidates?.[0]?.finishReason === "SAFETY") {
        throw new Error("SAFETY");
      }
      throw new Error("The model failed to generate an edited image for this request.");
    }

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }

    throw new Error("No image data found in the AI response.");
  } catch (e: any) {
    console.error("Editing failure:", e);
    throw new Error(translateError(e));
  }
};

export const extractElements = async (
  dataUrl: string,
  instruction: string
): Promise<string> => {
  assertApiKey();
  const ai = new GoogleGenAI({ apiKey: getActiveApiKey() });

  const prompt = `Task: Extract ONLY the specified elements and place them on a solid PURE GREEN (#00FF00) background.
  ELEMENTS TO EXTRACT: ${instruction}
  
  RULES:
  - Keep the elements in their EXACT original positions relative to the 16:9 frame.
  - The background must be 100% solid #00FF00 green.
  - Do not include any environment, shadows on the ground, or lighting from the original background.
  - Ensure high fidelity extraction.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          imagePart(dataUrl),
          { text: prompt }
        ]
      },
      config: {
        imageConfig: {
          aspectRatio: "16:9",
          imageSize: "1K"
        }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("Could not extract elements layer.");
  } catch (e: any) {
    console.error("Extraction failure:", e);
    throw new Error(translateError(e));
  }
};

export const enhanceThumbnail = async (dataUrl: string): Promise<string> => {
  assertApiKey();
  const ai = new GoogleGenAI({ apiKey: getActiveApiKey() });

  const prompt = `You are a professional YouTube thumbnail designer. 
  TASK: Auto-enhance this gaming thumbnail to make it look professional, vibrant, and eye-catching.
  
  ADJUSTMENTS:
  - Optimize brightness and contrast for high visibility.
  - Boost color saturation to make it "pop" without looking artificial.
  - Improve sharpness and clarity, especially on focal points.
  - Balance the levels to ensure a cinematic gaming aesthetic.
  
  CONSTRAINTS:
  - Maintain the 16:9 aspect ratio.
  - Do not add or remove any objects.
  - Output high resolution (1920x1080).`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          imagePart(dataUrl),
          { text: prompt }
        ]
      },
      config: {
        imageConfig: {
          aspectRatio: "16:9",
          imageSize: "1K"
        }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("The model failed to enhance the image.");
  } catch (e: any) {
    console.error("Enhancement failure:", e);
    throw new Error(translateError(e));
  }
};
