import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { MongoClient, type Document } from "mongodb";
import { defaultProducts } from "../shared/products.js";

type ProductSeed = Document & {
  id: string;
  name: string;
  description: string;
  price: number;
  compareAt: null;
  image: string;
  productType: string;
  stock: number;
  sizes: string[];
  colors: string[];
  status: "Draft";
  mainCategoryId: string;
  subcategoryId: string;
  mainCategory: string;
  subcategory: string;
  createdAt: string;
  updatedAt: string;
};

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (!process.env.MONGODB_URI) {
    const localEnvPath = path.resolve(process.cwd(), "backend", ".env.local");
    if (existsSync(localEnvPath)) process.loadEnvFile(localEnvPath);
  }
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is not configured (set it in the environment or backend/.env.local)");
  }

  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db(process.env.MONGODB_DB || "tribull");
    const collection = db.collection<ProductSeed>("products");
    if (!dryRun) await collection.createIndex({ id: 1 }, { unique: true });
    const existingCount = await collection.countDocuments();
    const now = new Date().toISOString();
    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    for (const source of defaultProducts) {
      const seed: ProductSeed = {
        id: source.id,
        name: source.name,
        description: "",
        price: source.price,
        compareAt: source.originalPrice ?? null,
        image: source.image,
        productType: source.category,
        stock: 0,
        sizes: [],
        colors: [],
        status: "Draft",
        mainCategoryId: "",
        subcategoryId: "",
        mainCategory: "",
        subcategory: "",
        createdAt: now,
        updatedAt: now,
      };

      const existing = await collection.findOne({ id: seed.id });
      if (existing) {
        skipped += 1;
        continue;
      }
      const legacy = await collection.findOne({ name: seed.name, productType: seed.productType });
      if (legacy) {
        if (legacy.id == null || legacy.id === "") {
          const result = dryRun
            ? { modifiedCount: 1 }
            : await collection.updateOne(
              { _id: legacy._id, id: { $in: [null, ""] } },
              { $set: { id: seed.id } },
            );
          if (result.modifiedCount === 1) updated += 1;
          else skipped += 1;
        } else {
          skipped += 1;
        }
        continue;
      }
      if (dryRun) {
        inserted += 1;
      } else {
        const result = await collection.updateOne({ id: seed.id }, { $setOnInsert: seed }, { upsert: true });
        if (result.upsertedCount === 1) inserted += 1;
        else skipped += 1;
      }
    }

    const finalCount = await collection.countDocuments();
    console.log(JSON.stringify({
      database: db.databaseName,
      collection: "products",
      mode: dryRun ? "dry-run" : "applied",
      discovered: defaultProducts.length,
      existingBefore: existingCount,
      inserted,
      updated,
      skipped,
      finalCount,
    }, null, 2));
  } finally {
    await client.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Product migration failed");
  process.exitCode = 1;
});
