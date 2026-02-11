import express, { Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { extractText, extractStructuredData } from "./extractText";

const app = express();
const PORT = process.env.PORT || 3000;

// Configure multer for file uploads
const uploadsDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Only allow image files
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed"));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

// Serve static files from public directory
app.use(express.static(path.join(__dirname, "../public")));

// Parse JSON bodies
app.use(express.json());

// Health check endpoint
app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok" });
});

// API endpoint for text extraction
app.post("/api/extract", upload.single("image"), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image file provided" });
    }

    const filePath = req.file.path;

    // Extract text from the uploaded image
    const extractedText = await extractText(filePath);

    // Clean up the uploaded file
    fs.unlink(filePath, (err) => {
      if (err) console.error("Error deleting file:", err);
    });

    res.json({ text: extractedText });
  } catch (error) {
    // Clean up the uploaded file if there's an error
    if (req.file) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error("Error deleting file:", err);
      });
    }

    const message = error instanceof Error ? error.message : "An error occurred";
    res.status(500).json({ error: message });
  }
});

// API endpoint for structured data extraction (e.g., invoice fields)
app.post("/api/extract-structured", upload.single("image"), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image file provided" });
    }

    const filePath = req.file.path;
    const fields = req.body.fields ? JSON.parse(req.body.fields) : ["invoiceNumber", "licensePlate", "amountDue", "dueDate"];

    // Extract structured data from the uploaded image
    const structuredData = await extractStructuredData(filePath, fields);

    // Clean up the uploaded file
    fs.unlink(filePath, (err) => {
      if (err) console.error("Error deleting file:", err);
    });

    res.json({ data: structuredData });
  } catch (error) {
    // Clean up the uploaded file if there's an error
    if (req.file) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error("Error deleting file:", err);
      });
    }

    const message = error instanceof Error ? error.message : "An error occurred";
    res.status(500).json({ error: message });
  }
});

// 404 handler for API routes
app.use("/api", (req: Request, res: Response) => {
  res.status(404).json({ error: "API endpoint not found" });
});

// Serve index.html for all other routes
app.get("*", (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

// Error handling middleware for multer
app.use((err: any, req: Request, res: Response, next: any) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "File size exceeds 5MB limit" });
    }
  }

  if (err && err.message) {
    return res.status(400).json({ error: err.message });
  }

  res.status(500).json({ error: "An error occurred" });
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║  Image Text Extractor Server Started   ║
╠════════════════════════════════════════╣
║  Server running at:                    ║
║   http://localhost:${PORT}            ║
╚════════════════════════════════════════╝
  `);
});
