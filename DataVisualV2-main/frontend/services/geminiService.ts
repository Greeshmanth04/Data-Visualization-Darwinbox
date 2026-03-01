import { GoogleGenAI, Type } from "@google/genai";
import { Dataset, AIAnalysisResult } from '../types';
import { getToken } from './api';

let _ai: any = null;
const getAI = () => {
  if (!_ai && process.env.GEMINI_API_KEY) {
    try {
      _ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    } catch (e) {
      console.warn("Failed to initialize GoogleGenAI:", e);
    }
  }
  return _ai;
};


export const generateQueryFromNaturalLanguage = async (
  prompt: string,
  datasets: Dataset[],
  activeDatasetId?: string
): Promise<string> => {
  const selectedDataset = datasets.find(d => d.id === activeDatasetId) || datasets[0];
  const dialect = selectedDataset?.sourceType === 'mongodb' ? 'mongodb' : 'sql';

  // Create a schema summary for the context
  const schemaContext = datasets.map(d =>
    `Table: ${d.id} (${d.description})\nColumns: ${d.columns.map(c => `${c.name} (${c.type})`).join(', ')}`
  ).join('\n\n');

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch('/api/ai/generate-query', {
      method: 'POST',
      headers,
      body: JSON.stringify({ prompt, schemaContext, dialect })
    });

    if (!response.ok) {
      throw new Error('Backend failed');
    }

    const result = await response.json();
    return result.query;
  } catch (error) {
    console.error(`AI ${dialect.toUpperCase()} Gen Error (falling back to frontend):`, error);

    // Fallback if backend is not available
    if (!process.env.GEMINI_API_KEY) {
      return dialect === 'mongodb'
        ? `// Error: AI Service unavailable\ndb.${selectedDataset?.name || 'metrics'}.find({}).limit(10);`
        : `-- Error: AI Service unavailable\nSELECT * FROM ${selectedDataset?.name || 'sales_2024'} LIMIT 10;`;
    }

    // Original frontend logic as fallback
    const dialectInstruction = dialect === 'mongodb'
      ? 'Use MongoDB aggregation pipeline or find query syntax.'
      : 'Use standard SQL syntax suitable for SQLite.';

    const fullPrompt = `
      You are an expert ${dialect.toUpperCase()} dialect translator for a custom analytics engine.
      Database Schema:
      ${schemaContext}
      User Request: "${prompt}"
      Instructions:
      1. Return ONLY the ${dialect.toUpperCase()} query.
      2. ${dialectInstruction}
    `;

    try {
      const response = await getAI().models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ role: 'user', parts: [{ text: fullPrompt }] }]
      });
      return response.text.trim();
    } catch (e) {
      return `// Error generating ${dialect.toUpperCase()}. Please try again.`;
    }
  }
};

export const generateDashboardInsights = async (
  data: any[],
  context: string
): Promise<string> => {
  if (!process.env.GEMINI_API_KEY) return "AI Insights unavailable without API Key.";

  // Limit data sent to avoid token limits
  const sampleData = JSON.stringify(data.slice(0, 20));

  const prompt = `
    Analyze the following dataset context: ${context}.
    Here is a sample of the data: ${sampleData}.
    
    Provide 3 concise, bullet-pointed business insights that would be valuable for an executive dashboard.
    Keep it professional and brief.
  `;

  try {
    const response = await getAI().models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Insights Error:", error);
    return "Could not generate insights at this time.";
  }
};

export const analyzeDataset = async (
  dataset: Dataset
): Promise<AIAnalysisResult | null> => {
  if (!process.env.GEMINI_API_KEY) {
    console.warn("API Key missing for analysis");
    return {
      summary: "Demo Mode: API Key missing. Unable to generate real analysis.",
      trends: [{ title: "Demo Trend", description: "Please configure your API key to see real trends." }],
      anomalies: [{ title: "Demo Anomaly", description: "No anomalies detected in demo mode.", severity: "low" }],
      correlations: [],
      recommendations: ["Add API Key to .env"]
    };
  }

  const sampleData = JSON.stringify(dataset.data.slice(0, 50));

  const prompt = `
    Perform a comprehensive data analysis on the following dataset.
    
    Dataset Name: ${dataset.name}
    Description: ${dataset.description}
    Columns: ${dataset.columns.map(c => `${c.name} (${c.type})`).join(', ')}
    
    Sample Data:
    ${sampleData}

    Tasks:
    1. Summarize the key takeaways.
    2. Identify ongoing trends or patterns.
    3. Detect anomalies or outliers (assign severity: low, medium, high).
    4. Find correlations between variables.
    5. Suggest next steps or recommendations for the user.
  `;

  try {
    const response = await getAI().models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            trends: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  description: { type: Type.STRING }
                }
              }
            },
            anomalies: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  severity: { type: Type.STRING }
                }
              }
            },
            correlations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  factor1: { type: Type.STRING },
                  factor2: { type: Type.STRING },
                  description: { type: Type.STRING }
                }
              }
            },
            recommendations: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          }
        }
      }
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Deep Analysis Error:", error);
    return null;
  }
}

export const answerKnowledgeBaseQuestion = async (
  question: string,
  datasets: Dataset[]
): Promise<string> => {
  if (!process.env.GEMINI_API_KEY) return "AI Assistant unavailable without API Key.";

  const schemaContext = datasets.map(d =>
    `Dataset: ${d.name}\nDescription: ${d.description}\nFields: ${d.columns.map(c => c.name).join(', ')}`
  ).join('\n\n');

  const prompt = `
    You are a helpful Data Steward for the DarwinVisualize platform.
    
    Documentation Context:
    ${schemaContext}

    User Question: "${question}"

    Answer the user's question about the data catalog, definitions, or how to use the data. 
    Be helpful and encourage data literacy.
   `;

  try {
    const response = await getAI().models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ role: 'user', parts: [{ text: prompt }] }]
    });
    return response.text;
  } catch (error) {
    return "I'm having trouble accessing the knowledge base right now.";
  }
}
