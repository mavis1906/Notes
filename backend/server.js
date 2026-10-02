import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenAI, createPartFromUri } from "@google/genai";

dotenv.config();

const app = express();
const port = 5000;

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "AI backend is running" });
});

app.post("/api/ai/analyze", async (req, res) => {
  try {
    const { fileUrl, fileName } = req.body;

    if (!fileUrl) {
      return res.status(400).json({
        success: false,
        error: "PDF URL is required"
      });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: [
        createPartFromUri(fileUrl, "application/pdf"),
        `Analyze this university study note titled "${fileName || "study note"}".

Structure the analysis in exactly this order:

1. Simple Summary
Provide a clear and simple summary of the main topics covered in the document.

2. All Key Points
Identify all important points, principles, concepts, terms, processes, examples, and details that a university student should understand from the document. Do not limit this section to only a few concepts.

3. Difficult Concepts
Identify the most difficult concepts found in the document and explain each one clearly in a way that a university student can understand.

4. Ten Difficult Study Questions
Create exactly 10 challenging study questions based strictly on the information contained in the document. The questions should test understanding, reasoning, application, relationships between concepts, and important details rather than simple recall.

After the 10 questions, provide the corresponding answers in the same numbered order. These answers are intended to be hidden by the application and revealed only when the student clicks "Show Answers".

The 10 questions must be the final visible study section of the analysis.

Do not create questions or answers using information that is not contained in the document.

Keep the explanation clear, accurate, and suitable for a university student.`
      ]
    });

    res.json({
      success: true,
      response: response.text
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: "AI analysis failed"
    });
  }
});

app.listen(port, () => {
  console.log(`AI backend running on http://localhost:${port}`);
});