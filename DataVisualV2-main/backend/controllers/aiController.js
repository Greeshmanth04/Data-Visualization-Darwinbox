import { GoogleGenAI } from "@google/genai";
import { getCache, setCache } from '../utils/cacheService.js';

const genAI = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;

export const generateQuery = async (req, res) => {
    const { prompt, schemaContext, dialect = 'sql' } = req.body;
    const cacheKey = `ai_query:${dialect}:${Buffer.from(prompt).toString('base64')}`;
    try {
        const cached = await getCache(cacheKey);
        if (cached) return res.json({ query: cached });

        if (!genAI) return res.status(503).json({ message: 'AI Service not configured' });

        const dialectInstruction = dialect === 'mongodb'
            ? 'Use MongoDB aggregation pipeline or find query syntax.'
            : 'Use standard SQL syntax suitable for SQLite.';

        const fullPrompt = `
      You are an expert ${dialect.toUpperCase()} dialect translator for a custom analytics engine.
      Database Schema: ${schemaContext}
      User Request: "${prompt}"
      Instructions:
      1. Return ONLY the ${dialect.toUpperCase()} query.
      2. Do not add markdown backticks.
      3. ${dialectInstruction}
      4. If the request is ambiguous, make a reasonable assumption based on column names.
    `;

        const response = await genAI.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: [{ role: 'user', parts: [{ text: fullPrompt }] }]
        });
        const query = response.text.trim();
        await setCache(cacheKey, query, 86400);
        res.json({ query });
    } catch (e) {
        res.status(500).json({ message: `Failed to generate ${dialect.toUpperCase()} query` });
    }
};
