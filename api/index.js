import { app, connectDatabase } from "../backend/index.js";

export default async function handler(req, res) {
  try {
    // Vercel rewrites /api/* here and exposes the captured path as `path`.
    // Restore the URL expected by the Express app, keeping caller query params.
    const requestUrl = new URL(req.url, "http://vercel.local");
    const path = requestUrl.searchParams.get("path") || "";
    requestUrl.searchParams.delete("path");
    req.url = `/api/${path}${requestUrl.search}`;

    await connectDatabase();
    return app(req, res);
  } catch (error) {
    console.error("Could not connect to Supabase Postgres:", error.message);
    return res.status(503).json({ message: "The service is temporarily unavailable." });
  }
}
