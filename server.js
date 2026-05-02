const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const csvtojson = require("csvtojson");
const fs = require("fs");
const XLSX = require("xlsx");

const app = express();
const PORT = 5000;

app.use(express.json());
app.use(express.static("public"));

mongoose
  .connect("mongodb://127.0.0.1:27017/retailDB")
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err.message));

const productSchema = new mongoose.Schema({
  product: String,
  category: String,
  price: Number,
  quantity: Number,
  revenue: Number
});

const Product = mongoose.model("Product", productSchema);
const upload = multer({ dest: "uploads/" });
const allowedSortFields = ["product", "category", "price", "quantity", "revenue"];

app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Please select a file" });
    }

    const filePath = req.file.path;
    const originalName = req.file.originalname.toLowerCase();
    let data = [];

    if (originalName.endsWith(".csv")) {
      data = await csvtojson().fromFile(filePath);
    } else if (originalName.endsWith(".json")) {
      const raw = fs.readFileSync(filePath, "utf-8");
      data = JSON.parse(raw);
    } else if (originalName.endsWith(".xlsx") || originalName.endsWith(".xls")) {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      data = XLSX.utils.sheet_to_json(sheet);
    } else {
      fs.unlinkSync(filePath);
      return res.status(400).json({ message: "Only CSV, JSON, and Excel (.xlsx/.xls) files are allowed" });
    }

    const cleanedData = data
      .map((item) => ({
        product:  item.product  || item.Product  || item["Product Name"] || item.name || "Unknown",
        category: item.category || item.Category || "Uncategorized",
        price:    parseFloat(item.price    || item.Price    || item["Unit Price ($)"] || 0) || 0,
        quantity: parseFloat(item.quantity || item.Quantity || 0) || 0,
        revenue:  parseFloat(item.revenue  || item.Revenue  || item["Net Sales ($)"] || item["Total Sales ($)"] || item["Total Revenue"] || 0) || 0
      }))
      .filter((item) => !isNaN(item.revenue) && item.revenue > 0 && item.product !== "Unknown");

    await Product.deleteMany({});
    await Product.insertMany(cleanedData);
    fs.unlinkSync(filePath);

    res.json({ message: "File uploaded and data replaced successfully", inserted: cleanedData.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/max", async (_req, res) => {
  try {
    const result = await Product.aggregate([
      { $sort: { revenue: -1 } }, { $limit: 1 },
      { $project: { _id: 0, product: 1, category: 1, maxRevenue: "$revenue" } }
    ]);
    res.json(result[0] || {});
  } catch (error) { res.status(500).json({ message: error.message }); }
});

app.get("/min", async (_req, res) => {
  try {
    const result = await Product.aggregate([
      { $sort: { revenue: 1 } }, { $limit: 1 },
      { $project: { _id: 0, product: 1, category: 1, minRevenue: "$revenue" } }
    ]);
    res.json(result[0] || {});
  } catch (error) { res.status(500).json({ message: error.message }); }
});

app.get("/count", async (_req, res) => {
  try {
    const result = await Product.aggregate([{ $count: "totalProducts" }]);
    res.json(result[0] || { totalProducts: 0 });
  } catch (error) { res.status(500).json({ message: error.message }); }
});

app.get("/average", async (_req, res) => {
  try {
    const result = await Product.aggregate([
      { $group: { _id: null, averageRevenue: { $avg: "$revenue" } } }
    ]);
    res.json(result[0] ? { averageRevenue: result[0].averageRevenue } : {});
  } catch (error) { res.status(500).json({ message: error.message }); }
});

app.get("/filter", async (req, res) => {
  try {
    const operator = req.query.operator;
    const rawValue = Number(req.query.value);
    if (!["gt", "lt", "eq"].includes(operator)) return res.status(400).json({ message: "Use gt, lt, or eq" });
    if (Number.isNaN(rawValue)) return res.status(400).json({ message: "Please provide a valid number" });
    const operatorMap = { gt: "$gt", lt: "$lt", eq: "$eq" };
    const result = await Product.aggregate([{ $match: { revenue: { [operatorMap[operator]]: rawValue } } }]);
    res.json(result);
  } catch (error) { res.status(500).json({ message: error.message }); }
});

app.get("/sort", async (req, res) => {
  try {
    const field = req.query.field || "revenue";
    const order = req.query.order === "asc" ? 1 : -1;
    if (!allowedSortFields.includes(field)) return res.status(400).json({ message: "Invalid sort field" });
    const result = await Product.aggregate([{ $sort: { [field]: order } }]);
    res.json(result);
  } catch (error) { res.status(500).json({ message: error.message }); }
});

app.get("/skip", async (req, res) => {
  try {
    const skip = Number(req.query.skip) || 0;
    const result = await Product.aggregate([{ $skip: skip }]);
    res.json(result);
  } catch (error) { res.status(500).json({ message: error.message }); }
});

app.get("/limit", async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 50;
    const result = await Product.aggregate([{ $limit: limit }]);
    res.json(result);
  } catch (error) { res.status(500).json({ message: error.message }); }
});

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
