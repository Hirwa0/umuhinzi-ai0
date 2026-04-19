import { GoogleGenAI, Type } from "@google/genai";

export { Type };

const APP_ENGINE_TOKEN = (import.meta as any).env?.VITE_APP_ENGINE_TOKEN || (import.meta as any).env?.GEMINI_API_KEY || "";
const ENGINE_MODEL = "gemini-3-flash-preview";

const ai = new GoogleGenAI({ apiKey: APP_ENGINE_TOKEN || "" });

/**
 * Intelligent Engine Integration for UMUHINZI AI
 */
export async function callEngine<T = any>(
  fn: (ai: any, model: string) => Promise<T>,
  retries = 5,
  delay = 1000,
  onBusyState?: (busy: boolean) => void
): Promise<T> {
  const isInternalRetry = arguments[4] === true; // Undocumented recursion flag
  
  try {
    if (!APP_ENGINE_TOKEN) {
      console.error("System configuration error: VITE_APP_ENGINE_TOKEN is missing.");
      throw new Error("System configuration error. Please contact the administrator.");
    }

    if (!isInternalRetry) onBusyState?.(true);
    return await fn(ai, ENGINE_MODEL);
  } catch (error: any) {
    const isRateLimit = error?.message?.includes('429') || error?.message?.includes('RESOURCE_EXHAUSTED');
    
    if (isRateLimit && retries > 0) {
      console.warn(`Engine busy, retrying in ${delay}ms... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      // @ts-ignore - passing extra arg for recursion tracking
      return callEngine(fn, retries - 1, delay * 2, onBusyState, true);
    }
    
    throw error;
  } finally {
    if (!isInternalRetry) onBusyState?.(false);
  }
}

/**
 * Optimized result parser for engine responses
 */
export function parseEngineResponse(response: any): any {
  try {
    if (!response) return "";
    const text = typeof response.text === 'function' ? response.text() : (response.text || String(response));
    const jsonMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return text;
  } catch (e) {
    console.error("Result parsing failed", e);
    return response;
  }
}

/**
 * Generate an image using Gemini 2.5 Flash Image
 */
export async function generateEngineImage(prompt: string, onBusyState?: (busy: boolean) => void): Promise<string | null> {
  try {
    onBusyState?.(true);
    // Directly use the ai instance and call generateContent with the image model
    const response = await callEngine((aiInstance) => aiInstance.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        imageConfig: {
          aspectRatio: "1:1",
          imageSize: "1K"
        }
      }
    }), 3, 2000, undefined); 

    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }
    return null;
  } catch (error) {
    console.error("Image generation failed:", error);
    return null;
  } finally {
    onBusyState?.(false);
  }
}
