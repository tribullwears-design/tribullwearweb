import { MongoClient, type Db } from "mongodb";
import fs from "node:fs";
import path from "node:path";

let clientPromise: Promise<MongoClient> | undefined;

function getMongoUri() {
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI;
  try {
    const envPath = path.resolve(process.cwd(), "backend", ".env.production");
    const line = fs.readFileSync(envPath, "utf8").split(/\r?\n/).find((entry) => entry.startsWith("MONGODB_URI="));
    return line?.slice("MONGODB_URI=".length).trim();
  } catch {
    return undefined;
  }
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
