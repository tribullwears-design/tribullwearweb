import { MongoClient, type Db } from "mongodb";
import fs from "node:fs";
import path from "node:path";

let clientPromise: Promise<MongoClient> | undefined;

function getMongoUri() {
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI;
  const envCandidates = [
    path.resolve(process.cwd(), "backend", ".env.local"),
    path.resolve(process.cwd(), "backend", ".env.production"),
  ];
  for (const envPath of envCandidates) {
    try {
      const envContents = fs.readFileSync(envPath, "utf8");
      const line = envContents.split(/\r?\n/).find((entry) => entry.startsWith("MONGODB_URI="));
      if (line) return line.slice("MONGODB_URI=".length).trim();
    } catch {
      // continue to the next candidate
    }
  }
  return undefined;
}

export async function getDatabase(): Promise<Db> {
  const uri = getMongoUri();
  if (!uri) throw new Error("MONGODB_URI is not configured");
  if (!clientPromise) {
    clientPromise = new MongoClient(uri).connect().catch((error: unknown) => {
      clientPromise = undefined;
      throw error;
    });
  }
  const client = await clientPromise;
  return client.db(process.env.MONGODB_DB || "tribull");
}
