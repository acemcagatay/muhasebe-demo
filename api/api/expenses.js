import fs from "fs";
import path from "path";

const filePath = path.join(process.cwd(), "data.json");

export default function handler(req, res) {
  if (req.method === "POST") {
    const newData = req.body;

    let data = [];
    if (fs.existsSync(filePath)) {
      data = JSON.parse(fs.readFileSync(filePath));
    }

    data.push(newData);
    fs.writeFileSync(filePath, JSON.stringify(data));

    res.status(200).json({ success: true });
  }

  if (req.method === "GET") {
    if (!fs.existsSync(filePath)) {
      return res.status(200).json([]);
    }

    const data = JSON.parse(fs.readFileSync(filePath));
    res.status(200).json(data);
  }
}
