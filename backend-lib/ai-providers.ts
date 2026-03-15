export interface AIProvider {
  name: string;
  generateResponse(prompt: string, model: string, outputFormat?: any): Promise<any>;
}

export class OpenAIProvider implements AIProvider {
  name = "openai";
  async generateResponse(prompt: string, model: string, outputFormat?: any) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY not found");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model || "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: outputFormat ? { type: "json_object" } : undefined
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${error}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    return outputFormat ? JSON.parse(content) : content;
  }
}

export class GroqProvider implements AIProvider {
  name = "groq";
  async generateResponse(prompt: string, model: string, outputFormat?: any) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error("GROQ_API_KEY not found");

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model || "llama3-70b-8192",
        messages: [{ role: "user", content: prompt }],
        response_format: outputFormat ? { type: "json_object" } : undefined
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Groq API error: ${error}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    return outputFormat ? JSON.parse(content) : content;
  }
}

export class OpenRouterProvider implements AIProvider {
  name = "openrouter";
  async generateResponse(prompt: string, model: string, outputFormat?: any) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error("OPENROUTER_API_KEY not found");

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": "https://zo.space",
        "X-Title": "Zo AI App Builder"
      },
      body: JSON.stringify({
        model: model || "anthropic/claude-3.5-sonnet",
        messages: [{ role: "user", content: prompt }],
        response_format: outputFormat ? { type: "json_object" } : undefined
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter API error: ${error}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    return outputFormat ? JSON.parse(content) : content;
  }
}

export class GeminiProvider implements AIProvider {
  name = "gemini";
  async generateResponse(prompt: string, model: string, outputFormat?: any) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY not found");

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model || 'gemini-1.5-pro'}:generateContent?key=${apiKey}`;
    
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: outputFormat ? { response_mime_type: "application/json" } : undefined
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${error}`);
    }

    const data = await response.json();
    const content = data.candidates[0].content.parts[0].text;
    return outputFormat ? JSON.parse(content) : content;
  }
}

export function getProvider(providerName: string): AIProvider {
  switch (providerName.toLowerCase()) {
    case "openai": return new OpenAIProvider();
    case "groq": return new GroqProvider();
    case "openrouter": return new OpenRouterProvider();
    case "gemini": return new GeminiProvider();
    default: throw new Error(`Unknown provider: ${providerName}`);
  }
}
