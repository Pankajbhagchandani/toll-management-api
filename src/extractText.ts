import Anthropic from "@anthropic-ai/sdk";
import https from "https";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  throw new Error("ANTHROPIC_API_KEY environment variable is not set");
}
const client = new Anthropic({ apiKey });

async function fetchFileAsBase64(filePath: string): Promise<{ data: string; mediaType: string }> {
  // Check if it's a local file
  if (fs.existsSync(filePath)) {
    const fileBuffer = fs.readFileSync(filePath);
    const base64 = fileBuffer.toString("base64");
    const ext = path.extname(filePath).toLowerCase();
    const mediaType = 
      ext === ".pdf" ? "application/pdf" :
      ext === ".png" ? "image/png" :
      ext === ".gif" ? "image/gif" :
      ext === ".webp" ? "image/webp" :
      "image/jpeg";
    return { data: base64, mediaType };
  }
  
  // Otherwise treat as URL
  return new Promise((resolve, reject) => {
    https.get(filePath, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => {
        const buffer = Buffer.concat(chunks);
        const contentType = response.headers["content-type"] || "image/jpeg";
        resolve({ 
          data: buffer.toString("base64"),
          mediaType: contentType.split(";")[0]
        });
      });
      response.on("error", reject);
    }).on("error", reject);
  });
}

export async function extractText(filePath: string): Promise<string> {
  const { data: base64Data, mediaType } = await fetchFileAsBase64(filePath);

  const messageContent: any[] = [];
  
  if (mediaType === "application/pdf") {
    messageContent.push({
      type: "document",
      source: {
        type: "base64",
        media_type: mediaType,
        data: base64Data,
      },
    });
  } else {
    messageContent.push({
      type: "image",
      source: {
        type: "base64",
        media_type: mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
        data: base64Data,
      },
    });
  }

  messageContent.push({
    type: "text",
    text: "Please extract all text from this document and return it in markdown format.",
  });

  const response = await client.messages.create({
    model: "claude-opus-4-1-20250805",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: messageContent,
      },
    ],
  });

  // Extract text content from response
  const textContent = response.content.find((block) => block.type === "text");
  if (textContent && textContent.type === "text") {
    return textContent.text;
  }

  return "";
}

export interface InvoiceData {
  invoiceNumber?: string;
  licensePlate?: string;
  amountDue?: string;
  dueDate?: string;
  company?: string;
  address?: string;
  [key: string]: string | undefined;
}

export async function extractStructuredData(filePath: string, fields: string[] = ["invoiceNumber", "licensePlate", "amountDue", "dueDate"]): Promise<InvoiceData> {
  const { data: base64Data, mediaType } = await fetchFileAsBase64(filePath);

  const fieldsDescription = fields.map(field => {
    const descriptions: { [key: string]: string } = {
      invoiceNumber: "Invoice number or ID",
      licensePlate: "License plate number or vehicle registration",
      amountDue: "Amount due (total amount to pay)",
      dueDate: "Due date for payment",
      company: "Company or organization name",
      address: "Address"
    };
    return descriptions[field] || field;
  }).join(", ");

  const messageContent: any[] = [];
  
  if (mediaType === "application/pdf") {
    messageContent.push({
      type: "document",
      source: {
        type: "base64",
        media_type: mediaType,
        data: base64Data,
      },
    });
  } else {
    messageContent.push({
      type: "image",
      source: {
        type: "base64",
        media_type: mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
        data: base64Data,
      },
    });
  }

  messageContent.push({
    type: "text",
    text: `Extract the following information from this document and return ONLY a JSON object (no markdown, no extra text): ${fieldsDescription}.

Return as JSON like this example:
{
  "invoiceNumber": "value",
  "licensePlate": "value",
  "amountDue": "value",
  "dueDate": "value"
}

If a field is not found, use null.`,
  });

  const response = await client.messages.create({
    model: "claude-opus-4-1-20250805",
    max_tokens: 500,
    messages: [
      {
        role: "user",
        content: messageContent,
      },
    ],
  });

  const textContent = response.content.find((block) => block.type === "text");
  if (!textContent || textContent.type !== "text") {
    return {};
  }

  try {
    const jsonText = textContent.text.trim();
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed;
    }
  } catch (error) {
    console.error("Failed to parse structured data:", error);
  }

  return {};
}

// CLI support for backward compatibility
if (require.main === module) {
  const imagePath = process.argv[2] || "https://example.com/sample-image.jpg";
  extractText(imagePath).then((text) => {
    console.log("Extracted Text:", text);
  }).catch((error) => {
    console.error("Error:", error.message);
    process.exit(1);
  });
}