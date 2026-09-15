import { MongoClient, type Collection, type Db } from "mongodb";
import fs from "node:fs";
import path from "node:path";

export type CategoryDocument = {
  value: string;
  label: string;
  image?: string;
  subcategories: { value: string; label: string; image?: string }[];
  position: number;
};

const defaultCategories: CategoryDocument[] = [
  { value: "cinema", label: "Cinema", image: "/products/cinema.jpg", position: 0, subcategories: [
    { value: "hollywood", label: "Hollywood", image: "/products/hollywood.jpg" },
    { value: "bollywood", label: "Bollywood", image: "/products/bollywood.jpg" },
    { value: "kollywood", label: "Kollywood", image: "/products/kollywood.jpg" },
    { value: "tollywood", label: "Tollywood", image: "/products/tollywood.jpg" },
    { value: "mollywood", label: "Mollywood", image: "/products/mollywood.jpg" },
    { value: "sandalwood", label: "Sandalwood", image: "/products/sandalwood.jpg" },
  ] },
  { value: "sports", label: "Sports", image: "/products/sports.png", position: 1, subcategories: [
    { value: "cricket", label: "Cricket", image: "/products/cricket.jpg" },
    { value: "football", label: "Football", image: "/products/football.jpg" },
    { value: "gym", label: "Gym", image: "/products/gym.jpg" },
  ] },
  { value: "games", label: "Games", image: "/products/games.jpg", position: 2, subcategories: [
    { value: "pc-games", label: "PC Games", image: "/products/pc games.jpg" },
    { value: "mobile-games", label: "Mobile Games", image: "/products/mobilegames.jpg" },
  ] },
  { value: "motorsports", label: "MotoSports", image: "/products/motosports.jpg", position: 3, subcategories: [
    { value: "car", label: "Car", image: "/products/car.jpg" },
    { value: "bike", label: "Bike", image: "/products/bike.jpg" },
  ] },
];

let clientPromise: Promise<MongoClient> | undefined;

function readMongoUri() {
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI;
  try {
    const envPath = path.resolve(process.cwd(), "backend", ".env.production");
    const line = fs.readFileSync(envPath, "utf8").split(/\r?\n/).find((entry) => entry.startsWith("MONGODB_URI="));
    return line?.slice("MONGODB_URI=".length).trim();
  } catch {
    return undefined;
  }
}

async function getCollection(): Promise<Collection<CategoryDocument>> {
  const uri = readMongoUri();
  if (!uri) throw new Error("MONGODB_URI is not configured");
  clientPromise ||= new MongoClient(uri).connect();
  const client = await clientPromise;
  const db: Db = client.db(process.env.MONGODB_DB || "tribull");
  const collection = db.collection<CategoryDocument>("main-category");
  await collection.createIndex({ value: 1 }, { unique: true });
  return collection;
}

export async function listCategories() {
  const collection = await getCollection();
  if (await collection.countDocuments() === 0) await collection.insertMany(defaultCategories);
  return collection.find({}, { projection: { _id: 0 } }).sort({ position: 1, label: 1 }).toArray();
}

export async function replaceCategories(categories: CategoryDocument[]) {
  const collection = await getCollection();
  const values = new Set<string>();
  for (const category of categories) {
    if (!category.value || values.has(category.value)) throw new Error("Duplicate category value");
    values.add(category.value);
  }
  await collection.deleteMany({ value: { $nin: categories.map((category) => category.value) } });
  for (let position = 0; position < categories.length; position += 1) {
    const category = categories[position];
    await collection.replaceOne({ value: category.value }, { ...category, position }, { upsert: true });
  }
  return listCategories();
}

export async function createCategory(category: Omit<CategoryDocument, "position" | "subcategories"> & { subcategories?: CategoryDocument["subcategories"] }) {
  const collection = await getCollection();
  const position = await collection.countDocuments();
  const document = { ...category, subcategories: category.subcategories || [], position };
  await collection.insertOne(document);
  return document;
}

export async function updateCategory(value: string, changes: Partial<Pick<CategoryDocument, "label" | "image">>) {
  const collection = await getCollection();
  const result = await collection.findOneAndUpdate({ value }, { $set: changes }, { returnDocument: "after", projection: { _id: 0 } });
  return result;
}

export async function deleteCategory(value: string) {
  const collection = await getCollection();
  return (await collection.deleteOne({ value })).deletedCount > 0;
}

async function updateSubcategories(parent: string, updater: (items: CategoryDocument["subcategories"]) => CategoryDocument["subcategories"]) {
  const collection = await getCollection();
  const category = await collection.findOne({ value: parent });
  if (!category) return undefined;
  const subcategories = updater(category.subcategories || []);
  return collection.findOneAndUpdate({ value: parent }, { $set: { subcategories } }, { returnDocument: "after", projection: { _id: 0 } });
}

export function addSubcategory(parent: string, item: CategoryDocument["subcategories"][number]) {
  return updateSubcategories(parent, (items) => {
    if (items.some((current) => current.value === item.value || current.label.toLowerCase() === item.label.toLowerCase())) throw new Error("Duplicate subcategory");
    return [...items, item];
  });
}

export function editSubcategory(parent: string, value: string, item: CategoryDocument["subcategories"][number]) {
  return updateSubcategories(parent, (items) => items.map((current) => current.value === value ? { ...current, ...item } : current));
}

export function removeSubcategory(parent: string, value: string) {
  return updateSubcategories(parent, (items) => items.filter((current) => current.value !== value));
}
