const { createHash } = require("node:crypto");

const VERSION = 1;
const COLLECTION = "adminDirectory";
const DATE_FIELDS = ["createdAt", "created_at", "createdOn", "created_on", "dateCreated", "date_created", "createdDate", "created_date", "timestamp"];
const EMAIL_FIELDS = ["email", "eMail", "userEmail", "user_email", "emailAddress", "email_address", "contactEmail", "contact_email", "mail"];
const VENDOR_EMAIL_FIELDS = ["email", "eMail", "emailAddress", "email_address", "contactEmail", "contact_email", "vendorEmail", "vendor_email", "ownerEmail", "owner_email", "userEmail", "user_email", "contact"];
const PHONE_FIELDS = ["phoneNumber", "phone_number", "phone", "mobileNumber", "mobile_number", "mobile", "contactNumber", "contact_number", "telephone", "contact"];

function firstString(data, fields, fallback = "") {
  for (const field of fields) if (typeof data?.[field] === "string" && data[field].trim()) return data[field].trim();
  return fallback;
}

function phone(data) {
  for (const field of PHONE_FIELDS) {
    const value = data?.[field];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function createdAt(data) {
  for (const field of DATE_FIELDS) {
    let value = data?.[field];
    if (value == null || value === "") continue;
    if (typeof value?.toMillis === "function") value = value.toMillis();
    else if (typeof value?.seconds === "number") value = value.seconds * 1000 + (value.nanoseconds || 0) / 1e6;
    else if (typeof value === "number" || (typeof value === "string" && Number.isFinite(Number(value)))) {
      value = Number(value);
      if (Math.abs(value) < 1e12) value *= 1000;
    }
    const milliseconds = new Date(value).getTime();
    if (Number.isFinite(milliseconds)) return milliseconds;
  }
  return null;
}

// One-, two- and three-character grams preserve the existing substring search.
// The query narrows candidates using a gram; the bounded page reader checks the full text.
function searchTokens(values) {
  const tokens = new Set();
  for (const value of values) {
    const text = value.toLowerCase();
    for (let size = 1; size <= 3; size++) {
      for (let start = 0; start <= text.length - size; start++) tokens.add(text.slice(start, start + size));
    }
  }
  return [...tokens];
}

function indexedRecord(kind, id, record, texts) {
  const nameSort = (kind === "vendor" ? record.stallName : record.name).normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase()
    .replace(/\d+/g, (digits) => digits.padStart(16, "0"));
  return {
    kind, entityId: id, record,
    role: record.role ?? "", category: record.category ?? "", isOpen: record.isOpen ?? false,
    nameSort, dateMissing: record.createdAt === null, dateSort: record.createdAt ?? 0,
    searchTexts: texts.map((text) => text.toLowerCase()), searchTokens: searchTokens(texts),
  };
}

function buildDirectoryRecords(id, user, vendor, authEmail = "") {
  const records = {};
  if (user || vendor) {
    const data = vendor ?? user;
    const collectionName = vendor ? "vendors" : "users";
    const rawRole = String(data.role ?? data.userRole ?? (vendor ? "vendor" : data.type ?? "customer")).toLowerCase();
    const role = ["customer", "vendor", "admin"].includes(rawRole) ? rawRole : vendor ? "vendor" : "customer";
    const name = firstString(data, vendor ? ["name", "stallName", "fullName", "ownerName"] : ["name", "fullName", "displayName", "username", "userName"], vendor ? "Vendor Account" : "Customer User");
    const email = firstString(data, vendor ? VENDOR_EMAIL_FIELDS : EMAIL_FIELDS)
      || firstString(user, EMAIL_FIELDS) || authEmail || "No Email Provided";
    const record = {
      id, name, email, phoneNumber: phone(data) || phone(user), collectionName,
      role, isAccountDisabled: Boolean(data.isAccountDisabled), createdAt: createdAt(data),
    };
    records.account = indexedRecord("account", id, record, [name, email]);
  }
  if (vendor) {
    const latitude = Number(vendor.latitude ?? vendor.lat ?? 0);
    const longitude = Number(vendor.longitude ?? vendor.lng ?? 0);
    const imageUrl = firstString(vendor, ["profileImageUrl", "profilePictureUrl", "photoURL", "photoUrl", "imageUrl", "imageURL", "image"]);
    const record = {
      id, vendorId: id, name: vendor.name || vendor.stallName || "Unknown",
      stallName: vendor.stallName || vendor.name || "Unknown", description: vendor.description || "",
      category: vendor.category || "Unknown", openingHours: vendor.openingHours || vendor.hours || "",
      hours: vendor.hours || vendor.openingHours || "", isOpen: Boolean(vendor.isOpen),
      latitude: Number.isFinite(latitude) ? latitude : 0, longitude: Number.isFinite(longitude) ? longitude : 0,
      lat: Number.isFinite(latitude) ? latitude : 0, lng: Number.isFinite(longitude) ? longitude : 0,
      imageUrl, profileImageUrl: imageUrl, phoneNumber: phone(vendor) || phone(user),
      isAccountDisabled: Boolean(vendor.isAccountDisabled), createdAt: createdAt(vendor),
    };
    records.vendor = indexedRecord("vendor", id, record, [String(record.stallName), String(record.category), record.phoneNumber]);
  }
  return records;
}

function invalid(message) {
  const error = new Error(message);
  error.code = "invalid-argument";
  throw error;
}

function pageOptions(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) invalid("Invalid page request.");
  const kind = input.kind;
  if (!["account", "vendor"].includes(kind)) invalid("Invalid directory.");
  const sort = input.sort ?? "newest";
  if (!["newest", "oldest", "name-asc", "name-desc"].includes(sort)) invalid("Invalid sort.");
  const size = input.pageSize ?? 25;
  if (![10, 25, 50].includes(size)) invalid("Invalid page size.");
  const search = input.search ?? "";
  if (typeof search !== "string" || search.length > 200) invalid("Search must be at most 200 characters.");
  const role = input.role ?? "all";
  const status = input.status ?? "All";
  const category = input.category ?? "All";
  if (!["all", "customer", "vendor", "admin"].includes(role) || !["All", "Open", "Closed"].includes(status) || typeof category !== "string" || category.length > 200) invalid("Invalid filter.");
  const options = { kind, sort, pageSize: size, search: search.trim().toLowerCase(), role, status, category };
  const scope = createHash("sha256").update(JSON.stringify(options)).digest("hex");
  let after = null;
  if (input.cursor != null) {
    if (typeof input.cursor !== "string" || input.cursor.length > 8000) invalid("Invalid page cursor.");
    try {
      const cursor = JSON.parse(Buffer.from(input.cursor, "base64url").toString());
      const values = cursor.values;
      const dateSort = sort === "newest" || sort === "oldest";
      if (cursor.version !== VERSION || cursor.scope !== scope || !Array.isArray(values)
        || values.length !== (dateSort ? 3 : 2)
        || typeof values.at(-1) !== "string" || !values.at(-1) || values.at(-1).includes("/")
        || (dateSort ? typeof values[0] !== "boolean" || !Number.isFinite(values[1]) : typeof values[0] !== "string")) throw new Error();
      after = values;
    } catch { invalid("Invalid page cursor. Return to the first page."); }
  }
  return { ...options, scope, after };
}

function cursorValues(doc, sort) {
  const data = doc.data();
  return sort === "newest" || sort === "oldest" ? [data.dateMissing, data.dateSort, doc.id] : [data.nameSort, doc.id];
}

async function readDirectoryPage(collection, input) {
  const options = pageOptions(input);
  let query = collection.where("kind", "==", options.kind);
  if (options.kind === "account" && options.role !== "all") query = query.where("role", "==", options.role);
  if (options.kind === "vendor") {
    if (options.category !== "All") query = query.where("category", "==", options.category);
    if (options.status !== "All") query = query.where("isOpen", "==", options.status === "Open");
  }
  if (options.search) query = query.where("searchTokens", "array-contains", options.search.slice(0, 3));
  if (options.sort === "newest" || options.sort === "oldest") {
    query = query.orderBy("dateMissing", "asc").orderBy("dateSort", options.sort === "newest" ? "desc" : "asc");
  } else query = query.orderBy("nameSort", options.sort === "name-desc" ? "desc" : "asc");
  query = query.orderBy("__name__", "asc");
  if (options.after) query = query.startAfter(...options.after);

  const records = [];
  let last = null;
  let exhausted = false;
  let scanned = 0;
  // Each request reads at most 200 candidates. It never downloads the collection.
  while (records.length < options.pageSize && scanned < 200) {
    const limit = Math.min(options.search ? 50 : options.pageSize - records.length, 200 - scanned);
    const snapshot = await query.limit(limit).get();
    scanned += snapshot.docs.length;
    for (const doc of snapshot.docs) {
      last = doc;
      const data = doc.data();
      if (!options.search || data.searchTexts.some((text) => text.includes(options.search))) records.push(data.record);
      if (records.length === options.pageSize) break;
    }
    const consumedBatch = !snapshot.docs.length || last === snapshot.docs.at(-1);
    if (consumedBatch && snapshot.docs.length < limit) { exhausted = true; break; }
    if (last) query = query.startAfter(...cursorValues(last, options.sort));
  }
  // One bounded lookahead avoids an unnecessary empty page for exact-sized results.
  if (!exhausted && last) exhausted = (await query.limit(1).get()).empty;
  return {
    version: VERSION, records,
    nextCursor: exhausted || !last ? null : Buffer.from(JSON.stringify({ version: VERSION, scope: options.scope, values: cursorValues(last, options.sort) })).toString("base64url"),
  };
}

// Re-read both source profiles inside the transaction so duplicate, delayed and
// out-of-order source events cannot restore stale directory entries.
async function syncDirectoryAccount(firestore, auth, id) {
  let authEmail = "";
  try { authEmail = (await auth.getUser(id)).email ?? ""; }
  catch (error) { if (!["auth/user-not-found", "auth/invalid-uid"].includes(error.code)) throw error; }
  await firestore.runTransaction(async (transaction) => {
    const [user, vendor, previous] = await transaction.getAll(
      firestore.doc(`users/${id}`), firestore.doc(`vendors/${id}`), firestore.doc(`${COLLECTION}/vendor_${id}`)
    );
    const records = buildDirectoryRecords(id, user.exists ? user.data() : null, vendor.exists ? vendor.data() : null, authEmail);
    const oldCategory = previous.exists ? previous.data().category : null;
    const newCategory = records.vendor?.category ?? null;
    const categories = [...new Set([oldCategory, newCategory].filter((value) => value !== null))];
    const refs = categories.map((category) => firestore.doc(`adminDirectoryCategories/${createHash("sha256").update(category).digest("hex")}`));
    const facets = refs.length ? await transaction.getAll(...refs) : [];
    for (const kind of ["account", "vendor"]) {
      const ref = firestore.doc(`${COLLECTION}/${kind}_${id}`);
      if (records[kind]) transaction.set(ref, records[kind]);
      else transaction.delete(ref);
    }
    if (oldCategory !== newCategory) {
      categories.forEach((category, index) => {
        const count = (facets[index].data()?.count ?? 0) + (category === newCategory ? 1 : -1);
        if (count > 0) transaction.set(refs[index], { category, count });
        else transaction.delete(refs[index]);
      });
    }
  });
}

module.exports = { VERSION, COLLECTION, buildDirectoryRecords, pageOptions, readDirectoryPage, syncDirectoryAccount };
