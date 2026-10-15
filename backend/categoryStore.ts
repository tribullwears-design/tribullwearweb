import { type Collection } from "mongodb";
import { getDatabase } from "./database.js";

export type CategoryDocument = {
  value: string;
  label: string;
  image?: string;
  isVisible?: boolean;
  subcategories: { value: string; label: string; image?: string; isVisible?: boolean }[];
  position: number;
};

export class CategoryConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CategoryConflictError";
  }
}

export type CategoryAssignment = { mainCategoryId: string; subcategoryId?: string };

export function getRemovedCategoryAssignments(
  current: CategoryDocument[],
  next: CategoryDocument[],
): CategoryAssignment[] {
  const nextByValue = new Map(next.map((category) => [category.value, category]));
  const removed: CategoryAssignment[] = [];

  for (const category of current) {
    const nextCategory = nextByValue.get(category.value);
    if (!nextCategory) {
      removed.push({ mainCategoryId: category.value });
      continue;
    }
    const nextSubcategoryValues = new Set((nextCategory.subcategories || []).map((subcategory) => subcategory.value));
    for (const subcategory of category.subcategories || []) {
      if (!nextSubcategoryValues.has(subcategory.value)) {
        removed.push({ mainCategoryId: category.value, subcategoryId: subcategory.value });
      }
    }
  }

  return removed;
}

async function assertNoProductAssignments(assignments: CategoryAssignment[]) {
  if (assignments.length === 0) return;
  const products = (await getDatabase()).collection("products");
  const filters = assignments.map(({ mainCategoryId, subcategoryId }) => ({
    mainCategoryId,
    ...(subcategoryId === undefined ? {} : { subcategoryId }),
  }));
  const assignedProduct = await products.findOne({ $or: filters }, { projection: { _id: 1 } });
  if (assignedProduct) {
    throw new CategoryConflictError("Cannot remove categories assigned to products. Reassign those products first.");
  }
}

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

async function getCollection(): Promise<Collection<CategoryDocument>> {
  const db = await getDatabase();
  return db.collection<CategoryDocument>("main-category");
}

async function ensureCategoryValueIndex(collection: Collection<CategoryDocument>) {
  await collection.createIndex({ value: 1 }, { unique: true });
}

let visibilityDefaultsPromise: Promise<void> | undefined;

function ensureVisibilityDefaults(collection: Collection<CategoryDocument>) {
  if (!visibilityDefaultsPromise) {
    const migration = (async () => {
      await collection.updateMany({ isVisible: { $exists: false } }, { $set: { isVisible: true } });
      await collection.updateMany(
        { "subcategories.isVisible": { $exists: false } },
        { $set: { "subcategories.$[subcategory].isVisible": true } },
        { arrayFilters: [{ "subcategory.isVisible": { $exists: false } }] },
      );
    })();
    visibilityDefaultsPromise = migration.catch((error: unknown) => {
      visibilityDefaultsPromise = undefined;
      throw error;
    });
  }
  return visibilityDefaultsPromise;
}

export async function listCategories() {
  const collection = await getCollection();
  if (await collection.countDocuments() === 0) await collection.insertMany(defaultCategories);
  await ensureVisibilityDefaults(collection);
  const categories = await collection.find({}, { projection: { _id: 0 } }).sort({ position: 1, label: 1 }).toArray();
  return categories.map((category) => ({
    ...category,
    isVisible: category.isVisible !== false,
    subcategories: (category.subcategories || []).map((subcategory) => ({
      ...subcategory,
      isVisible: subcategory.isVisible !== false,
    })),
  }));
}

export async function replaceCategories(categories: CategoryDocument[]) {
  if (!Array.isArray(categories)) throw new Error("Categories must be a list");
  const collection = await getCollection();
  await ensureCategoryValueIndex(collection);
  const current = await collection.find({}, { projection: { _id: 0 } }).toArray();
  const values = new Set<string>();
  for (const category of categories) {
    if (!category.value || values.has(category.value)) throw new CategoryConflictError("Duplicate category value");
    values.add(category.value);
  }
  await assertNoProductAssignments(getRemovedCategoryAssignments(current, categories));
  await collection.deleteMany({ value: { $nin: categories.map((category) => category.value) } });
  for (let position = 0; position < categories.length; position += 1) {
    const category = categories[position];
    await collection.replaceOne({ value: category.value }, {
      ...category,
      isVisible: category.isVisible !== false,
      subcategories: (category.subcategories || []).map((subcategory) => ({
        ...subcategory,
        isVisible: subcategory.isVisible !== false,
      })),
      position,
    }, { upsert: true });
  }
  return listCategories();
}

export async function createCategory(category: Omit<CategoryDocument, "position" | "subcategories"> & { subcategories?: CategoryDocument["subcategories"] }) {
  const collection = await getCollection();
  await ensureCategoryValueIndex(collection);
  if (!category.value?.trim() || !category.label?.trim()) throw new Error("Category name is required");
  if (await collection.findOne({ value: category.value })) throw new CategoryConflictError("Duplicate category");
  const position = await collection.countDocuments();
  const document = {
    ...category,
    isVisible: category.isVisible !== false,
    subcategories: (category.subcategories || []).map((subcategory) => ({
      ...subcategory,
      isVisible: subcategory.isVisible !== false,
    })),
    position,
  };
  await collection.insertOne(document);
  return document;
}

export async function updateCategory(value: string, changes: Partial<Pick<CategoryDocument, "label" | "image">>) {
  const collection = await getCollection();
  const result = await collection.findOneAndUpdate({ value }, { $set: changes }, { returnDocument: "after", projection: { _id: 0 } });
  return result;
}

export async function setCategoryVisibility(value: string, isVisible: boolean) {
  const collection = await getCollection();
  return collection.findOneAndUpdate(
    { value },
    { $set: { isVisible } },
    { returnDocument: "after", projection: { _id: 0 } },
  );
}

export async function setSubcategoryVisibility(parent: string, value: string, isVisible: boolean) {
  const collection = await getCollection();
  return collection.findOneAndUpdate(
    { value: parent, "subcategories.value": value },
    { $set: { "subcategories.$.isVisible": isVisible } },
    { returnDocument: "after", projection: { _id: 0 } },
  );
}

export async function deleteCategory(value: string) {
  const collection = await getCollection();
  await assertNoProductAssignments([{ mainCategoryId: value }]);
  return (await collection.deleteOne({ value })).deletedCount > 0;
}

async function updateSubcategories(parent: string, updater: (items: CategoryDocument["subcategories"]) => CategoryDocument["subcategories"]) {
  const collection = await getCollection();
  const category = await collection.findOne({ value: parent });
  if (!category) return undefined;
  const subcategories = updater(category.subcategories || []);
  await assertNoProductAssignments(getRemovedCategoryAssignments(
    [{ ...category, subcategories: category.subcategories || [] }],
    [{ ...category, subcategories }],
  ));
  return collection.findOneAndUpdate({ value: parent }, { $set: { subcategories } }, { returnDocument: "after", projection: { _id: 0 } });
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function addSubcategory(parent: string, item: CategoryDocument["subcategories"][number]) {
  const value = item.value?.trim();
  const label = item.label?.trim();
  if (!value || !label) throw new Error("Subcategory name is required");

  const collection = await getCollection();
  const subcategory = { ...item, value, label, isVisible: item.isVisible !== false };
  const result = await collection.findOneAndUpdate(
    {
      value: parent,
      $nor: [
        { "subcategories.value": new RegExp(`^${escapeRegExp(value)}$`, "i") },
        { "subcategories.label": new RegExp(`^${escapeRegExp(label)}$`, "i") },
      ],
    },
    { $push: { subcategories: subcategory } },
    { returnDocument: "after", projection: { _id: 0 } },
  );
  if (result) return result;

  if (await collection.findOne({ value: parent }, { projection: { _id: 1 } })) {
    throw new CategoryConflictError("Duplicate subcategory");
  }
  return undefined;
}

export function editSubcategory(parent: string, value: string, item: CategoryDocument["subcategories"][number]) {
  return updateSubcategories(parent, (items) => items.map((current) => current.value === value ? { ...current, ...item } : current));
}

export function removeSubcategory(parent: string, value: string) {
  return updateSubcategories(parent, (items) => items.filter((current) => current.value !== value));
}
