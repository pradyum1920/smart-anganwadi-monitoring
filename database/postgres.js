import { randomUUID } from "node:crypto";
import pg from "pg";

const { Pool } = pg;

let pool;
let connectionPromise;

export function getPool() {
  if (pool) return pool;

  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString)
    throw new Error("SUPABASE_DB_URL is required to connect to Supabase Postgres.");

  const local = /(?:localhost|127\.0\.0\.1|host\.docker\.internal)/i.test(
    connectionString,
  );
  const certificate = process.env.SUPABASE_CA_CERT?.replace(/\\n/g, "\n");

  pool = new Pool({
    connectionString,
    ssl: local
      ? false
      : certificate
        ? { ca: certificate, rejectUnauthorized: true }
        : { rejectUnauthorized: false },
    max: process.env.VERCEL === "1" ? 1 : 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

  pool.on("error", (error) => console.error("Supabase Postgres pool error:", error));
  return pool;
}

export async function connectDatabase() {
  if (!connectionPromise) {
    connectionPromise = getPool()
      .query("select 1")
      .then(() => undefined)
      .catch((error) => {
        connectionPromise = undefined;
        throw error;
      });
  }
  return connectionPromise;
}

export function databaseConnected() {
  return Boolean(pool && connectionPromise && !pool.ended);
}

export async function disconnectDatabase() {
  if (!pool) return;
  const current = pool;
  pool = undefined;
  connectionPromise = undefined;
  await current.end();
}

export function isValidRecordId(value) {
  return (
    typeof value === "string" &&
    (/^[a-f\d]{24}$/i.test(value) ||
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value,
      ))
  );
}

const jsonValue = (value) => {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(jsonValue);
  if (value && typeof value.toJSON === "function") return jsonValue(value.toJSON());
  if (value && typeof value === "object")
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, jsonValue(item)]));
  return value;
};

const readDateFields = new Set([
  "createdAt",
  "updatedAt",
  "passwordUpdatedAt",
  "dateOfBirth",
  "enrolledAt",
  "date",
  "validFrom",
  "completedAt",
  "scheduledAt",
  "readAt",
]);

function restoreDates(value, parentKey = "") {
  if (Array.isArray(value)) return value.map((item) => restoreDates(item, parentKey));
  if (!value || typeof value !== "object") {
    if (readDateFields.has(parentKey) && typeof value === "string") {
      const date = new Date(value);
      return Number.isNaN(date.valueOf()) ? value : date;
    }
    return value;
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, restoreDates(item, key)]),
  );
}

function addDocumentMethods(doc, model) {
  if (!doc) return doc;
  Object.defineProperties(doc, {
    id: { configurable: true, enumerable: false, get() { return this._id; } },
    toJSON: {
      configurable: true,
      enumerable: false,
      value() {
        const result = Object.fromEntries(
          Object.entries(this).map(([key, value]) => [key, jsonValue(value)]),
        );
        if (model.hideFields?.has("passwordHash") && !this.__includePassword)
          delete result.passwordHash;
        result.id = String(this._id);
        return result;
      },
    },
    toString: {
      configurable: true,
      enumerable: false,
      value() { return String(this._id); },
    },
    save: {
      configurable: true,
      enumerable: false,
      value: async () => {
        const stored = Object.fromEntries(
          Object.entries(doc).filter(([key]) => !key.startsWith("__")),
        );
        stored.updatedAt = new Date();
        doc.updatedAt = stored.updatedAt;
        await getPool().query(
          `update ${model.table} set document = $1::jsonb where id = $2`,
          [JSON.stringify(jsonValue(stored)), String(doc._id)],
        );
        return doc;
      },
    },
  });
  return doc;
}

function storageDocument(input, model, includePassword = false) {
  const doc = { ...structuredClone(model.defaults), ...input };
  const now = new Date();
  doc._id = String(doc._id || doc.id || randomUUID());
  delete doc.id;
  doc.createdAt = doc.createdAt || now;
  doc.updatedAt = now;
  if (model.hideFields?.has("passwordHash") && includePassword)
    Object.defineProperty(doc, "__includePassword", { value: true, enumerable: false });
  if (model.name === "User" && typeof doc.email === "string")
    doc.email = doc.email.trim().toLowerCase();
  if (model.name === "Center") {
    if (typeof doc.name === "string") doc.name = doc.name.trim();
    if (typeof doc.centerId === "string") doc.centerId = doc.centerId.trim();
  }
  return doc;
}

function hydrate(row, model, lean = false, includePassword = false) {
  if (!row) return null;
  const doc = restoreDates(row.document);
  doc._id = row.id;
  if (lean) {
    if (model.hideFields?.has("passwordHash")) delete doc.passwordHash;
    return doc;
  }
  if (model.hideFields?.has("passwordHash") && !includePassword) delete doc.passwordHash;
  if (includePassword)
    Object.defineProperty(doc, "__includePassword", {
      value: true,
      enumerable: false,
      configurable: true,
    });
  return addDocumentMethods(doc, model);
}

const pathExpression = (field) =>
  field === "_id" || field === "id"
    ? "t.id"
    : `t.document #>> '{${field.split(".").join(",")}}'`;

const pathJson = (field) =>
  field === "_id" || field === "id"
    ? "to_jsonb(t.id)"
    : `t.document #> '{${field.split(".").join(",")}}'`;

function comparisonExpression(field, operator, value, bind) {
  const expression = pathExpression(field);
  const numeric = typeof value === "number";
  const date = value instanceof Date;
  const comparison = { $gt: ">", $gte: ">=", $lt: "<", $lte: "<=" }[operator];
  const parameter = bind(numeric || date ? (date ? value.toISOString() : String(value)) : String(value));
  if (numeric) return `${expression}::numeric ${comparison} ${parameter}::numeric`;
  if (date || /^(?:\d{4}-\d\d-\d\d|\d{4}-\d\d-\d\dT)/.test(String(value)))
    return `${expression}::timestamptz ${comparison} ${parameter}::timestamptz`;
  return `${expression} ${comparison} ${parameter}`;
}

function arrayMatch(field, values, bind) {
  const candidates = bind(values.map((value) => String(value)));
  const parts = field.split(".");
  if (parts.length === 1) {
    const path = pathJson(field);
    return `(${pathExpression(field)} = any(${candidates}::text[]) or exists (select 1 from jsonb_array_elements_text(case when jsonb_typeof(${path}) = 'array' then ${path} else '[]'::jsonb end) as a(value) where a.value = any(${candidates}::text[])))`;
  }
  const root = parts.shift();
  const tail = parts.join("->>");
  const rootPath = `t.document #> '{${root}}'`;
  return `exists (select 1 from jsonb_array_elements(case when jsonb_typeof(${rootPath}) = 'array' then ${rootPath} else '[]'::jsonb end) as a(value) where a.value #>> '{${tail.split("->>").join(",")}}' = any(${candidates}::text[]))`;
}

function compileFilter(filter, bind) {
  if (!filter || !Object.keys(filter).length) return "true";
  const clauses = [];
  for (const [field, value] of Object.entries(filter)) {
    if (field === "$or" || field === "$and") {
      const inner = (value || []).map((row) => `(${compileFilter(row, bind)})`);
      clauses.push(inner.length ? inner.join(field === "$or" ? " or " : " and ") : "false");
      continue;
    }

    const operators = value instanceof RegExp
      ? ["$regex"]
      : value && typeof value === "object" && !(value instanceof Date) && !Array.isArray(value)
      ? Object.keys(value).filter((key) => key.startsWith("$"))
      : [];
    if (!operators.length) {
      if (value === null) clauses.push(`(${pathJson(field)} is null or ${pathJson(field)} = 'null'::jsonb)`);
      else if (Array.isArray(value)) clauses.push(`${pathJson(field)} = ${bind(JSON.stringify(value))}::jsonb`);
      else {
        const normalized = value instanceof Date ? value.toISOString() : String(value);
        clauses.push(`(${pathExpression(field)} = ${bind(normalized)} or ${arrayMatch(field, [normalized], bind)})`);
      }
      continue;
    }

    for (const operator of operators) {
      const operand = value[operator];
      if (operator === "$in") clauses.push(arrayMatch(field, operand || [], bind));
      else if (["$gt", "$gte", "$lt", "$lte"].includes(operator))
        clauses.push(comparisonExpression(field, operator, operand, bind));
      else if (operator === "$regex") {
        const pattern = value instanceof RegExp ? value.source : operand;
        const flags = value instanceof RegExp ? value.flags : value.$options || "";
        const caseInsensitive = String(flags).includes("i");
        clauses.push(`${pathExpression(field)} ${caseInsensitive ? "~*" : "~"} ${bind(String(pattern))}`);
      } else if (operator === "$options") continue;
      else if (operator === "$exists")
        clauses.push(`${pathJson(field)} is ${operand ? "not " : ""}null`);
      else throw new Error(`Unsupported query operator ${operator}.`);
    }
  }
  return clauses.map((clause) => `(${clause})`).join(" and ");
}

function filterBaseFields(filter = {}) {
  return Object.fromEntries(
    Object.entries(filter).filter(([key, value]) =>
      !key.startsWith("$") &&
      !(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).some((op) => op.startsWith("$"))) &&
      !(value && typeof value === "object" && !(value instanceof Date) && !Array.isArray(value)),
    ),
  );
}

function applyUpdate(doc, update = {}) {
  if (Object.keys(update).some((key) => key.startsWith("$"))) {
    if (update.$set) Object.assign(doc, update.$set);
    if (update.$unset)
      for (const key of Object.keys(update.$unset)) delete doc[key];
  } else Object.assign(doc, update);
  return doc;
}

function selectedDocument(doc, selection, model, includePassword) {
  if (!doc) return doc;
  if (selection) {
    const tokens = selection.trim().split(/\s+/).filter(Boolean);
    const includes = tokens.filter((token) => !token.startsWith("-") && !token.startsWith("+") && token !== "_id");
    const additions = tokens.filter((token) => token.startsWith("+")).map((token) => token.slice(1));
    const excludes = tokens.filter((token) => token.startsWith("-")).map((token) => token.slice(1));
    if (includes.length) {
      const picked = { _id: doc._id };
      for (const token of includes) {
        const path = token.replace(/^\+/, "").split(".");
        let source = doc;
        let target = picked;
        for (let i = 0; i < path.length; i++) {
          const key = path[i];
          if (source == null || !(key in source)) break;
          if (i === path.length - 1) target[key] = source[key];
          else {
            target[key] ||= {};
            target = target[key];
            source = source[key];
          }
        }
      }
      doc = picked;
    }
    for (const token of additions) {
      const path = token.split(".");
      let source = doc;
      let target = doc;
      for (let i = 0; i < path.length; i++) {
        const key = path[i];
        if (source == null || !(key in source)) break;
        if (i === path.length - 1) target[key] = source[key];
        else {
          target[key] ||= {};
          target = target[key];
          source = source[key];
        }
      }
    }
    for (const key of excludes) delete doc[key];
  }
  if (model.hideFields?.has("passwordHash") && !includePassword) delete doc.passwordHash;
  if (model.hideFields?.has("passwordHash") && includePassword)
    Object.defineProperty(doc, "__includePassword", { value: true, enumerable: false, configurable: true });
  if (!Object.prototype.hasOwnProperty.call(doc, "_id")) return doc;
  return addDocumentMethods(doc, model);
}

class ModelQuery {
  constructor(model, filter = {}, single = false) {
    this.model = model;
    this.filter = filter;
    this.single = single;
    this.selection = "";
    this.sorting = [];
    this.maxRows = null;
    this.populatePaths = [];
    this.isLean = false;
    this.distinctField = null;
    this.cached = null;
  }
  select(value) { this.selection = value || ""; return this; }
  sort(value) {
    if (typeof value === "string")
      this.sorting.push(...value.trim().split(/\s+/).filter(Boolean).map((key) => [key.replace(/^-/, ""), key.startsWith("-") ? -1 : 1]));
    else if (value && typeof value === "object") this.sorting.push(...Object.entries(value));
    return this;
  }
  limit(value) { this.maxRows = Number(value); return this; }
  populate(path, select) { this.populatePaths.push({ path: typeof path === "string" ? path : path.path, select: select || path.select || "" }); return this; }
  lean() { this.isLean = true; return this; }
  distinct(field) { this.distinctField = field; return this; }
  async exec() {
    if (this.cached) return this.cached;
    this.cached = this.run();
    return this.cached;
  }
  then(resolve, reject) { return this.exec().then(resolve, reject); }
  catch(reject) { return this.exec().catch(reject); }
  finally(callback) { return this.exec().finally(callback); }
  async run() {
    const bindValues = [];
    const bind = (value) => { bindValues.push(value); return `$${bindValues.length}`; };
    const where = compileFilter(this.filter, bind);
    let sql = `select t.id, t.document from ${this.model.table} t where ${where}`;
    if (this.sorting.length) {
      sql += " order by " + this.sorting.map(([field, direction]) =>
        `${pathExpression(field)} ${Number(direction) < 0 ? "desc" : "asc"} nulls last`,
      ).join(", ");
    }
    if (this.maxRows != null && Number.isFinite(this.maxRows)) sql += ` limit ${Math.max(0, Math.trunc(this.maxRows))}`;
    const result = await getPool().query(sql, bindValues);
    let docs = result.rows.map((row) => hydrate(row, this.model, this.isLean, this.selection.includes("+passwordHash")));
    if (this.populatePaths.length && !this.isLean)
      for (const item of this.populatePaths) docs = await populateDocuments(docs, this.model, item.path, item.select);
    docs = docs.map((doc) => selectedDocument(doc, this.selection, this.model, this.selection.includes("+passwordHash")));
    if (this.distinctField) {
      const values = docs.map((doc) => this.distinctField.split(".").reduce((row, key) => row?.[key], doc));
      return [...new Map(values.flatMap((value) => Array.isArray(value) ? value : [value]).filter((value) => value != null).map((value) => [String(value), value])).values()];
    }
    return this.single ? docs[0] || null : docs;
  }
}

async function populateDocuments(docs, model, path, selection) {
  const ref = model.references?.[path];
  if (!ref || !docs.length) return docs;
  const [parentPath, childField] = path.includes(".") ? path.split(".") : [path, null];
  const nested = childField != null;
  const ids = [];
  for (const doc of docs) {
    const values = doc[parentPath];
    if (nested && Array.isArray(values)) {
      for (const value of values)
        if (value?.[childField]) ids.push(String(value[childField]));
    } else if (!nested && Array.isArray(values)) ids.push(...values.map(String));
    else if (!nested && values) ids.push(String(values));
  }
  const related = ids.length
    ? await ref.model.find({ _id: { $in: [...new Set(ids)] } }).select(selection)
    : [];
  const byId = new Map(related.map((row) => [String(row._id), row]));
  for (const doc of docs) {
    const values = doc[parentPath];
    if (nested && Array.isArray(values))
      doc[parentPath] = values.map((value) => ({
        ...value,
        [childField]: value?.[childField] ? byId.get(String(value[childField])) || null : null,
      }));
    else if (!nested && Array.isArray(values))
      doc[parentPath] = values.map((id) => byId.get(String(id)) || null).filter(Boolean);
    else if (!nested && values) doc[parentPath] = byId.get(String(values)) || null;
  }
  return docs;
}

export function defineModel(name, tableName, { defaults = {}, hideFields = [], references = {} } = {}) {
  const model = {
    name,
    table: `public.${tableName}`,
    defaults,
    hideFields: new Set(hideFields),
    references: {},
  };
  model.references = Object.fromEntries(
    Object.entries(references).map(([path, target]) => [path, target]),
  );

  model.find = (filter = {}) => new ModelQuery(model, filter);
  model.findOne = (filter = {}) => new ModelQuery(model, filter, true);
  model.findById = (id) => new ModelQuery(model, { _id: String(id) }, true);
  model.countDocuments = async (filter = {}) => {
    const values = [];
    const bind = (value) => { values.push(value); return `$${values.length}`; };
    const where = compileFilter(filter, bind);
    const result = await getPool().query(`select count(*)::int as count from ${model.table} t where ${where}`, values);
    return result.rows[0].count;
  };
  model.exists = async (filter = {}) => {
    const row = await model.findOne(filter).select("_id");
    return row ? { _id: row._id } : null;
  };
  model.create = async (input) => {
    const doc = storageDocument(input, model, true);
    const result = await getPool().query(
      `insert into ${model.table} (id, document) values ($1, $2::jsonb) returning id, document`,
      [doc._id, JSON.stringify(jsonValue(doc))],
    );
    return hydrate(result.rows[0], model);
  };
  model.insertMany = async (inputs) => {
    const created = [];
    const batchSize = 250;
    for (let start = 0; start < inputs.length; start += batchSize) {
      const docs = inputs.slice(start, start + batchSize).map((input) => storageDocument(input, model, true));
      const values = [];
      const rows = docs.map((doc) => {
        values.push(doc._id, JSON.stringify(jsonValue(doc)));
        return `($${values.length - 1}, $${values.length}::jsonb)`;
      });
      if (!rows.length) continue;
      const result = await getPool().query(
        `insert into ${model.table} (id, document) values ${rows.join(", ")} returning id, document`,
        values,
      );
      created.push(...result.rows.map((row) => hydrate(row, model)));
    }
    return created;
  };
  model.deleteMany = async (filter = {}) => {
    const values = [];
    const bind = (value) => { values.push(value); return `$${values.length}`; };
    const where = compileFilter(filter, bind);
    const result = await getPool().query(`delete from ${model.table} t where ${where}`, values);
    return { deletedCount: result.rowCount };
  };
  model.findOneAndDelete = async (filter = {}) => {
    const found = await model.findOne(filter);
    if (!found) return null;
    await getPool().query(`delete from ${model.table} where id = $1`, [String(found._id)]);
    return found;
  };
  model.findByIdAndDelete = (id) => model.findOneAndDelete({ _id: String(id) });
  model.findOneAndUpdate = async (filter, update, options = {}) => {
    let findQuery = model.findOne(filter);
    if (model.hideFields?.has("passwordHash")) findQuery = findQuery.select("+passwordHash");
    let found = await findQuery;
    const existed = Boolean(found);
    if (!found && !options.upsert) return null;
    const doc = found || storageDocument(filterBaseFields(filter), model, true);
    applyUpdate(doc, update);
    doc.updatedAt = new Date();
    if (!existed) doc.createdAt = doc.createdAt || doc.updatedAt;
    const stored = Object.fromEntries(Object.entries(doc).filter(([key]) => !key.startsWith("__")));
    const result = existed
      ? await getPool().query(`update ${model.table} set document = $1::jsonb where id = $2 returning id, document`, [JSON.stringify(jsonValue(stored)), String(doc._id)])
      : await getPool().query(`insert into ${model.table} (id, document) values ($1, $2::jsonb) returning id, document`, [String(doc._id), JSON.stringify(jsonValue(stored))]);
    const updated = hydrate(result.rows[0], model);
    return options.new === false || options.returnDocument === "before" ? found : updated;
  };
  model.findByIdAndUpdate = (id, update, options) => model.findOneAndUpdate({ _id: String(id) }, update, options);
  model.updateOne = async (filter, update, options = {}) => {
    const existed = await model.findOne(filter);
    const result = await model.findOneAndUpdate(filter, update, options);
    return { acknowledged: true, matchedCount: existed ? 1 : 0, modifiedCount: existed ? 1 : 0, upsertedId: !existed && options.upsert ? result?._id : null };
  };
  model.aggregate = async (pipeline = []) => {
    const match = pipeline.find((step) => step.$match)?.$match || {};
    let rows = await model.find(match);
    const group = pipeline.find((step) => step.$group)?.$group;
    if (group) {
      const groupField = typeof group._id === "string" && group._id.startsWith("$") ? group._id.slice(1) : null;
      if (!groupField) {
        const result = { _id: null };
        for (const [key, expression] of Object.entries(group)) {
          if (key === "_id") continue;
          if (expression?.$sum === 1) result[key] = rows.length;
          else if (typeof expression?.$sum === "string") result[key] = rows.reduce((sum, row) => sum + Number(expression.$sum.slice(1).split(".").reduce((value, part) => value?.[part], row) || 0), 0);
        }
        rows = [result];
      } else rows = [...new Set(rows.map((row) => String(groupField.split(".").reduce((value, part) => value?.[part], row))))].map((value) => ({ _id: value }));
    }
    const count = pipeline.find((step) => step.$count)?.$count;
    if (count) rows = rows.length ? [{ [count]: rows.length }] : [];
    return rows;
  };
  return model;
}
