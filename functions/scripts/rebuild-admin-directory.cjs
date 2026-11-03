// Run after deploying the directory triggers and indexes. Uses Application Default
// Credentials; source user/vendor documents are never modified.
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const { readHistoryPage } = require("../historyPagination");
const { VERSION, syncDirectoryAccount } = require("../adminDirectory");

async function main({ credential, firestore: providedFirestore } = {}) {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT;
  if (!projectId) throw new Error("Set GOOGLE_CLOUD_PROJECT to the intended Firebase project.");
  initializeApp({ projectId, ...(credential ? { credential } : {}) });
  const firestore = providedFirestore ?? getFirestore();
  const auth = getAuth();
  const state = firestore.doc("adminDirectoryMeta/state");
  const previous = (await state.get()).data();
  let cursor = process.argv.includes("--resume") && previous?.version === VERSION && !previous.ready ? previous.cursor ?? null : null;
  await state.set({ version: VERSION, ready: false, cursor });
  let more = true;
  while (more) {
    const page = await readHistoryPage([firestore.collection("users"), firestore.collection("vendors")], { limit: 100, cursor });
    for (let offset = 0; offset < page.docs.length; offset += 5) {
      await Promise.all(page.docs.slice(offset, offset + 5).map((doc) => syncDirectoryAccount(firestore, auth, doc.id)));
    }
    cursor = page.nextCursor;
    more = cursor !== null;
    // Keep the final processed ID for a resumable, idempotent migration.
    await state.set({ version: VERSION, ready: !more, cursor: cursor ?? page.docs.at(-1)?.id ?? null });
    process.stdout.write(`Indexed ${page.docs.length} accounts; ${more ? "continuing" : "directory ready"}.\n`);
  }
}

module.exports = { main };
if (require.main === module) {
  main().catch((error) => { console.error(error); process.exitCode = 1; });
}
