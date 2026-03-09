import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import cookieParser from "cookie-parser";
import multer from "multer";
import fs from "fs";

const isProd = process.env.NODE_ENV === "production";
const dbPath = path.join(process.cwd(), "accounting.db");
const db = new Database(dbPath);

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Configure multer for logo upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `logo${ext}`);
  }
});
const upload = multer({ storage });

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    amount REAL NOT NULL,
    kdv_rate REAL DEFAULT 20,
    withholding_rate REAL DEFAULT 0,
    date TEXT NOT NULL,
    due_days INTEGER DEFAULT 0,
    due_date TEXT,
    description TEXT
  );

  CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    amount REAL NOT NULL,
    kdv_rate REAL DEFAULT 20,
    date TEXT NOT NULL,
    category TEXT,
    description TEXT
  );
`);

// Migration: Add missing columns if they don't exist
const columns = db.prepare("PRAGMA table_info(invoices)").all() as any[];
const columnNames = columns.map(c => c.name);

if (!columnNames.includes("withholding_rate")) {
  db.exec("ALTER TABLE invoices ADD COLUMN withholding_rate REAL DEFAULT 0");
}
if (!columnNames.includes("due_days")) {
  db.exec("ALTER TABLE invoices ADD COLUMN due_days INTEGER DEFAULT 0");
}
if (!columnNames.includes("due_date")) {
  db.exec("ALTER TABLE invoices ADD COLUMN due_date TEXT");
}
if (!columnNames.includes("is_paid")) {
  db.exec("ALTER TABLE invoices ADD COLUMN is_paid INTEGER DEFAULT 0");
}

db.exec(`
  CREATE TABLE IF NOT EXISTS prepayments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    amount REAL NOT NULL,
    date TEXT NOT NULL,
    description TEXT
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  INSERT OR IGNORE INTO settings (key, value) VALUES ('logo_url', 'https://picsum.photos/seed/accounting-logo/200/200');
`);

async function startServer() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  // Simple Auth Middleware
  const authMiddleware = (req: any, res: any, next: any) => {
    console.log(`Auth Middleware: ${req.method} ${req.path}`);
    if (req.path === "/api/login" || !req.path.startsWith("/api")) {
      return next();
    }
    const auth = req.cookies?.auth;
    if (auth === "authenticated") {
      next();
    } else {
      console.warn(`Auth Middleware: Unauthorized access attempt to ${req.path}`);
      res.status(401).json({ error: "Unauthorized" });
    }
  };

  app.use(authMiddleware);

  // Serve uploads statically
  app.use("/uploads", express.static(uploadsDir));

  // Auth Route
  app.post("/api/login", (req, res) => {
    const { username, password } = req.body;
    const adminUser = process.env.ADMIN_USERNAME || "NoxxHouse";
    const adminPass = process.env.ADMIN_PASSWORD || "Noxx3519";

    if (username === adminUser && password === adminPass) {
      res.cookie("auth", "authenticated", { httpOnly: true, sameSite: "none", secure: true });
      res.json({ success: true });
    } else {
      res.status(401).json({ success: false, message: "Hatalı kullanıcı adı veya şifre" });
    }
  });

  app.post("/api/logout", (req, res) => {
    res.clearCookie("auth");
    res.json({ success: true });
  });

  app.get("/api/check-auth", (req, res) => {
    if (req.cookies.auth === "authenticated") {
      res.json({ authenticated: true });
    } else {
      res.json({ authenticated: false });
    }
  });

  // Settings Routes
  app.get("/api/settings", (req, res) => {
    const rows = db.prepare("SELECT * FROM settings").all() as any[];
    const settings: Record<string, string> = {};
    rows.forEach(row => {
      settings[row.key] = row.value;
    });
    res.json(settings);
  });

  app.post("/api/settings", (req, res) => {
    const { key, value } = req.body;
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(key, value);
    res.json({ success: true });
  });

  app.post("/api/upload-logo", upload.single("logo"), (req, res) => {
    console.log("POST /api/upload-logo - Request received");
    if (!req.file) {
      console.error("POST /api/upload-logo - No file in request");
      return res.status(400).json({ success: false, message: "Dosya yüklenemedi" });
    }
    console.log("POST /api/upload-logo - File uploaded:", req.file.filename);
    const logoUrl = `/uploads/${req.file.filename}?t=${Date.now()}`;
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run("logo_url", logoUrl);
    res.json({ success: true, logoUrl });
  });

  // API Routes
  app.get("/api/invoices", (req, res) => {
    const rows = db.prepare("SELECT * FROM invoices ORDER BY date DESC").all();
    res.json(rows);
  });

  app.post("/api/invoices", (req, res) => {
    const { title, amount, kdv_rate, withholding_rate, date, due_days, due_date, description } = req.body;
    const info = db.prepare(
      "INSERT INTO invoices (title, amount, kdv_rate, withholding_rate, date, due_days, due_date, description, is_paid) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)"
    ).run(title, amount, kdv_rate, withholding_rate || 0, date, due_days || 0, due_date, description);
    res.json({ id: info.lastInsertRowid });
  });

  app.patch("/api/invoices/:id/payment", (req, res) => {
    const { is_paid } = req.body;
    db.prepare("UPDATE invoices SET is_paid = ? WHERE id = ?").run(is_paid ? 1 : 0, req.params.id);
    res.json({ success: true });
  });

  app.delete("/api/invoices/:id", (req, res) => {
    const { id } = req.params;
    console.log(`Server: Received request to delete invoice with id: ${id}`);
    try {
      const result = db.prepare("DELETE FROM invoices WHERE id = ?").run(id);
      console.log(`Server: Delete result for invoice ${id}:`, result);
      if (result.changes > 0) {
        res.json({ success: true });
      } else {
        console.warn(`Server: No invoice found with id: ${id}`);
        res.status(404).json({ success: false, message: "Kayıt bulunamadı" });
      }
    } catch (error: any) {
      console.error(`Server: Error deleting invoice ${id}:`, error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.put("/api/invoices/:id", (req, res) => {
    const { title, amount, kdv_rate, withholding_rate, date, due_days, due_date, description } = req.body;
    db.prepare(
      "UPDATE invoices SET title = ?, amount = ?, kdv_rate = ?, withholding_rate = ?, date = ?, due_days = ?, due_date = ?, description = ? WHERE id = ?"
    ).run(title, amount, kdv_rate, withholding_rate || 0, date, due_days || 0, due_date, description, req.params.id);
    res.json({ success: true });
  });

  app.get("/api/expenses", (req, res) => {
    const rows = db.prepare("SELECT * FROM expenses ORDER BY date DESC").all();
    res.json(rows);
  });

  app.post("/api/expenses", (req, res) => {
    const { title, amount, kdv_rate, date, category, description } = req.body;
    const info = db.prepare(
      "INSERT INTO expenses (title, amount, kdv_rate, date, category, description) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(title, amount, kdv_rate, date, category, description);
    res.json({ id: info.lastInsertRowid });
  });

  app.delete("/api/expenses/:id", (req, res) => {
    const { id } = req.params;
    console.log(`Server: Received request to delete expense with id: ${id}`);
    try {
      const result = db.prepare("DELETE FROM expenses WHERE id = ?").run(id);
      console.log(`Server: Delete result for expense ${id}:`, result);
      if (result.changes > 0) {
        res.json({ success: true });
      } else {
        console.warn(`Server: No expense found with id: ${id}`);
        res.status(404).json({ success: false, message: "Kayıt bulunamadı" });
      }
    } catch (error: any) {
      console.error(`Server: Error deleting expense ${id}:`, error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Prepayment Routes
  app.get("/api/prepayments", (req, res) => {
    const rows = db.prepare("SELECT * FROM prepayments ORDER BY date DESC").all();
    res.json(rows);
  });

  app.post("/api/prepayments", (req, res) => {
    const { title, amount, date, description } = req.body;
    const info = db.prepare(
      "INSERT INTO prepayments (title, amount, date, description) VALUES (?, ?, ?, ?)"
    ).run(title, amount, date, description);
    res.json({ id: info.lastInsertRowid });
  });

  app.delete("/api/prepayments/:id", (req, res) => {
    const { id } = req.params;
    console.log(`Server: Received request to delete prepayment with id: ${id}`);
    try {
      const result = db.prepare("DELETE FROM prepayments WHERE id = ?").run(id);
      console.log(`Server: Delete result for prepayment ${id}:`, result);
      if (result.changes > 0) {
        res.json({ success: true });
      } else {
        console.warn(`Server: No prepayment found with id: ${id}`);
        res.status(404).json({ success: false, message: "Kayıt bulunamadı" });
      }
    } catch (error: any) {
      console.error(`Server: Error deleting prepayment ${id}:`, error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.put("/api/prepayments/:id", (req, res) => {
    const { title, amount, date, description } = req.body;
    db.prepare(
      "UPDATE prepayments SET title = ?, amount = ?, date = ?, description = ? WHERE id = ?"
    ).run(title, amount, date, description, req.params.id);
    res.json({ success: true });
  });

  app.get("/api/summary", (req, res) => {
    const totalInvoices = db.prepare("SELECT SUM(amount) as total FROM invoices").get() as any;
    const totalExpenses = db.prepare("SELECT SUM(amount) as total FROM expenses").get() as any;
    const totalPrepayments = db.prepare("SELECT SUM(amount) as total FROM prepayments").get() as any;
    
    const invoices = db.prepare("SELECT amount, kdv_rate, withholding_rate FROM invoices").all() as any[];
    const expenses = db.prepare("SELECT amount, kdv_rate FROM expenses").all() as any[];
    
    let totalIncomeKdv = 0;
    let totalWithholding = 0;
    invoices.forEach(inv => {
      const kdvAmount = (inv.amount * inv.kdv_rate) / 100;
      const withholdingAmount = (kdvAmount * (inv.withholding_rate || 0)) / 10; // Tevkifat is usually X/10
      totalIncomeKdv += (kdvAmount - withholdingAmount);
      totalWithholding += withholdingAmount;
    });
    
    let totalExpenseKdv = 0;
    expenses.forEach(exp => {
      totalExpenseKdv += (exp.amount * exp.kdv_rate) / 100;
    });

    const totalInvoicesTotal = totalInvoices.total || 0;
    const totalPrepaymentsTotal = totalPrepayments.total || 0;
    const totalExpensesTotal = totalExpenses.total || 0;

    const totalIncome = totalInvoicesTotal;
    const remainingReceivable = Math.max(0, totalInvoicesTotal - totalPrepaymentsTotal);
    
    // Tax calculation should be based on total project amount (accrual basis)
    const netIncome = totalIncome - totalExpensesTotal;
    const estimatedIncomeTax = Math.max(0, netIncome * 0.15);
    const payableKdv = Math.max(0, totalIncomeKdv - totalExpenseKdv);
    
    // Net profit after tax
    const netProfitAfterTax = netIncome - estimatedIncomeTax - payableKdv;

    res.json({
      totalIncome,
      totalPrepayments: totalPrepaymentsTotal,
      remainingReceivable,
      totalExpense: totalExpensesTotal,
      totalIncomeKdv,
      totalExpenseKdv,
      totalWithholding,
      netIncome,
      estimatedIncomeTax,
      payableKdv,
      totalTax: estimatedIncomeTax + payableKdv,
      netProfitAfterTax
    });
  });

  // Vite middleware for development
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(process.cwd(), "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(process.cwd(), "dist", "index.html"));
    });
  }

  const PORT = 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
