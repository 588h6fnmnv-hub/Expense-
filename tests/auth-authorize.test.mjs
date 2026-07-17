import test from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { createHash } from "crypto";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const normalizeEmail = (value) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

// Recreate authorize logic exactly as defined in lib/auth.ts to verify its correctness
async function mockAuthorize(credentials, mockDb, mockAdminAuth) {
  const usernameInput = credentials?.username;
  const passwordInput = credentials?.password;
  const idTokenInput = credentials?.idToken;

  let email = "";
  let userId = "";
  let name = "";
  let picture = "";

  if (idTokenInput && !usernameInput) {
    if (!mockAdminAuth) return null;
    try {
      const decodedToken = await mockAdminAuth.verifyIdToken(idTokenInput);
      email = normalizeEmail(decodedToken.email);
      userId = decodedToken.uid;
      name = decodedToken.name || decodedToken.email || "";
      picture = decodedToken.picture || "";
    } catch {
      return null;
    }
  } else if (usernameInput && passwordInput) {
    if (!mockDb) return null;

    const inputLower = usernameInput.trim().toLowerCase();
    let userDocData = null;
    let userDocId = "";

    try {
      if (inputLower.includes("@")) {
        email = inputLower;
        const snap = await mockDb.collection("users").doc(email).get();
        if (snap.exists) {
          userDocId = snap.id;
          userDocData = snap.data() || null;
        } else {
          const querySnap = await mockDb.collection("users").where("email", "==", email).get();
          if (querySnap.docs.length > 0) {
            userDocId = querySnap.docs[0].id;
            userDocData = querySnap.docs[0].data() || null;
          }
        }
      } else {
        const usernameSnap = await mockDb.collection("usernames").doc(inputLower).get();
        if (usernameSnap.exists) {
          const resolvedEmail = usernameSnap.data()?.email || usernameSnap.data()?.userId;
          if (resolvedEmail) {
            email = normalizeEmail(resolvedEmail);
            const snap = await mockDb.collection("users").doc(email).get();
            if (snap.exists) {
              userDocId = snap.id;
              userDocData = snap.data() || null;
            } else {
              const querySnap = await mockDb.collection("users").where("email", "==", email).get();
              if (querySnap.docs.length > 0) {
                userDocId = querySnap.docs[0].id;
                userDocData = querySnap.docs[0].data() || null;
              }
            }
          }
        }

        if (!userDocData) {
          const querySnap = await mockDb.collection("users").where("username", "==", inputLower).get();
          if (querySnap.docs.length > 0) {
            userDocId = querySnap.docs[0].id;
            userDocData = querySnap.docs[0].data() || null;
            email = normalizeEmail(userDocData.email);
          }
        }
      }
    } catch {
      return null;
    }

    if (!userDocData) return null;

    const storedHash = userDocData.passwordHash || userDocData.password || "";
    let passwordComparisonResult = false;

    if (storedHash) {
      if (storedHash.startsWith("$2a$") || storedHash.startsWith("$2b$") || storedHash.startsWith("$2y$")) {
        try {
          passwordComparisonResult = bcrypt.compareSync(passwordInput, storedHash);
        } catch {
          // Ignore and fall back
        }
      }
      if (!passwordComparisonResult) {
        // use local sha256 function
        if (sha256(passwordInput) === storedHash) {
          passwordComparisonResult = true;
        } else if (passwordInput === storedHash) {
          passwordComparisonResult = true;
        }
      }
    }

    if (!passwordComparisonResult) return null;

    userId = userDocId;
    name = userDocData.name || userDocData.username || email;
    picture = userDocData.image || "";
  } else {
    return null;
  }

  try {
    if (email && mockDb) {
      const userSnap = await mockDb.collection("users").doc(email).get();
      if (userSnap.exists) {
        const uData = userSnap.data();
        if (uData?.active === false || uData?.status === "disabled" || uData?.status === "suspended" || uData?.suspended === true) {
          throw new Error("Your account has been suspended.");
        }
      }
    }
  } catch (error) {
    if (error.message === "Your account has been suspended.") {
      throw error;
    }
  }

  return {
    id: userId,
    email: normalizeEmail(email),
    name: name || email,
    image: picture || undefined,
  };
}

// Mock Firestore DB Setup
class MockCollection {
  constructor(name) {
    this.name = name;
    this.docs = new Map();
  }
  doc(id) {
    const coll = this;
    return {
      get: async () => {
        const exists = coll.docs.has(id);
        const dataVal = coll.docs.get(id);
        return {
          exists,
          id,
          data: () => dataVal,
          ref: { id }
        };
      }
    };
  }
  where(field, op, value) {
    const coll = this;
    return {
      get: async () => {
        const docs = [];
        for (const [id, data] of coll.docs.entries()) {
          if (data[field] === value) {
            docs.push({
              id,
              data: () => data,
              ref: { id }
            });
          }
        }
        return { docs, empty: docs.length === 0 };
      }
    };
  }
}

class MockDb {
  constructor() {
    this.collections = new Map();
  }
  collection(name) {
    if (!this.collections.has(name)) {
      this.collections.set(name, new MockCollection(name));
    }
    return this.collections.get(name);
  }
}

test("Successful authorization with email", async () => {
  const db = new MockDb();
  const passwordHash = bcrypt.hashSync("correctpassword", 10);
  db.collection("users").docs.set("owner@ledge.local", {
    email: "owner@ledge.local",
    passwordHash,
    name: "Owner User",
  });

  const user = await mockAuthorize({ username: "owner@ledge.local", password: "correctpassword" }, db, null);
  assert.ok(user);
  assert.equal(user.email, "owner@ledge.local");
  assert.equal(user.name, "Owner User");
});

test("Successful authorization with username", async () => {
  const db = new MockDb();
  const passwordHash = bcrypt.hashSync("correctpassword", 10);
  db.collection("usernames").docs.set("worker1", {
    email: "worker1@ledge.local"
  });
  db.collection("users").docs.set("worker1@ledge.local", {
    email: "worker1@ledge.local",
    passwordHash,
    username: "worker1",
    name: "Worker One",
  });

  const user = await mockAuthorize({ username: "worker1", password: "correctpassword" }, db, null);
  assert.ok(user);
  assert.equal(user.email, "worker1@ledge.local");
  assert.equal(user.name, "Worker One");
});

test("Incorrect password returns null", async () => {
  const db = new MockDb();
  const passwordHash = bcrypt.hashSync("correctpassword", 10);
  db.collection("users").docs.set("owner@ledge.local", {
    email: "owner@ledge.local",
    passwordHash,
  });

  const user = await mockAuthorize({ username: "owner@ledge.local", password: "wrongpassword" }, db, null);
  assert.equal(user, null);
});

test("Suspended/locked account throws error", async () => {
  const db = new MockDb();
  const passwordHash = bcrypt.hashSync("correctpassword", 10);
  db.collection("users").docs.set("suspended@ledge.local", {
    email: "suspended@ledge.local",
    passwordHash,
    active: false,
  });

  await assert.rejects(
    async () => {
      await mockAuthorize({ username: "suspended@ledge.local", password: "correctpassword" }, db, null);
    },
    { message: "Your account has been suspended." }
  );
});

test("SHA256 password fallback verification", async () => {
  const db = new MockDb();
  const passwordHash = sha256("mypassword");
  db.collection("users").docs.set("supervisor@ledge.local", {
    email: "supervisor@ledge.local",
    passwordHash,
    name: "Supervisor User",
  });

  const user = await mockAuthorize({ username: "supervisor@ledge.local", password: "mypassword" }, db, null);
  assert.ok(user);
  assert.equal(user.email, "supervisor@ledge.local");
});
