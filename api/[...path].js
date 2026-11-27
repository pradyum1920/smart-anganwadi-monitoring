import { app, connectDatabase } from "../server/index.js";

export default async function handler(req, res) {
  try {
    await connectDatabase();
    return app(req, res);
  } catch (error) {
    console.error("Could not connect to MongoDB:", error.message);
    return res.status(503).json({ message: "The service is temporarily unavailable." });
  }
}
