import {
  initializeDatabase,
  queryOne,
  run,
  runTransaction,
} from "../database/sqlite";

export interface AccountRecord {
  id: string;
  ownerName: string;
  email: string;
  mobile: string;
  passwordHash: string;
  supabaseUserId: string;
  createdAt: string;
}

export interface StoreRecord {
  id: string;
  accountId: string;
  storeName: string;
  subscriptionTier: "free" | "plus" | "premium";
  createdAt: string;
}

export interface SessionRecord {
  id: string;
  accountId: string;
  storeId: string;
  isActive: boolean;
  loginAt: string;
}

export interface AuthSessionBundle {
  account: AccountRecord;
  store: StoreRecord;
  session: SessionRecord;
}

const nowIso = () => new Date().toISOString();
const nowMs = () => Date.now();
const makeId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

const toHex = (bytes: Uint8Array) => {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
};

const fromUtf8 = (value: string) => new TextEncoder().encode(value);

const isEmail = (value: string) => value.includes("@");

const normalizeContact = (emailOrMobile: string) => {
  const clean = emailOrMobile.trim();
  if (!clean) throw new Error("Email or mobile is required.");
  if (isEmail(clean)) {
    return { email: clean.toLowerCase(), mobile: "" };
  }
  return { email: "", mobile: clean.replace(/\s+/g, "") };
};

const mapAccount = (row: any): AccountRecord => ({
  id: String(row.id),
  ownerName: row.owner_name || "",
  email: row.email || "",
  mobile: row.mobile || "",
  passwordHash: row.password_hash || "",
  supabaseUserId: row.supabase_user_id || "",
  createdAt: row.created_at || "",
});

const mapStore = (row: any): StoreRecord => ({
  id: String(row.id),
  accountId: String(row.account_id),
  storeName: row.store_name || "",
  subscriptionTier: (row.subscription_tier || "free") as StoreRecord["subscriptionTier"],
  createdAt: row.created_at || "",
});

const mapSession = (row: any): SessionRecord => ({
  id: String(row.id),
  accountId: String(row.account_id),
  storeId: String(row.store_id),
  isActive: Number(row.is_active) === 1,
  loginAt: row.login_at || "",
});

async function sha256(value: string) {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Secure hashing is unavailable in this environment.");
  }
  const digest = await globalThis.crypto.subtle.digest("SHA-256", fromUtf8(value));
  return toHex(new Uint8Array(digest));
}

function randomSalt() {
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error("Secure random generator is unavailable in this environment.");
  }
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return toHex(bytes);
}

async function findAccountByContact(emailOrMobile: string) {
  const contact = normalizeContact(emailOrMobile);
  if (contact.email) {
    const row = await queryOne<any>(
      "SELECT * FROM accounts WHERE lower(email) = lower(:email) LIMIT 1",
      { ":email": contact.email }
    );
    return row ? mapAccount(row) : null;
  }
  const row = await queryOne<any>(
    "SELECT * FROM accounts WHERE mobile = :mobile LIMIT 1",
    { ":mobile": contact.mobile }
  );
  return row ? mapAccount(row) : null;
}

async function findStoreByAccount(accountId: string) {
  const row = await queryOne<any>(
    "SELECT * FROM stores WHERE account_id = :account_id ORDER BY created_at ASC LIMIT 1",
    { ":account_id": accountId }
  );
  return row ? mapStore(row) : null;
}

export async function hashPassword(password: string) {
  if (!password) {
    throw new Error("Password is required.");
  }
  const salt = randomSalt();
  const digest = await sha256(`${salt}:${password}`);
  return `sha256:${salt}:${digest}`;
}

export async function verifyPassword(password: string, storedHash: string) {
  if (!password || !storedHash) return false;
  const parts = storedHash.split(":");
  if (parts.length === 3 && parts[0] === "sha256") {
    const [, salt, hash] = parts;
    const digest = await sha256(`${salt}:${password}`);
    return digest === hash;
  }
  // Legacy fallback for plain-text values from old local builds.
  return storedHash === password;
}

export async function createSession(accountId: string, storeId: string): Promise<SessionRecord> {
  await initializeDatabase();
  const sessionId = makeId("sess");
  const loginAt = nowIso();
  await runTransaction(db => {
    db.run("UPDATE sessions SET is_active = 0 WHERE is_active = 1");
    db.run(
      `INSERT INTO sessions (id, account_id, store_id, is_active, login_at)
       VALUES (:id, :account_id, :store_id, 1, :login_at)`,
      {
        ":id": sessionId,
        ":account_id": accountId,
        ":store_id": storeId,
        ":login_at": loginAt,
      }
    );
  });
  return {
    id: sessionId,
    accountId,
    storeId,
    isActive: true,
    loginAt,
  };
}

export async function clearSession() {
  await initializeDatabase();
  await run("UPDATE sessions SET is_active = 0 WHERE is_active = 1");
}

export async function getCurrentSession(): Promise<AuthSessionBundle | null> {
  await initializeDatabase();
  const sessionRow = await queryOne<any>(
    "SELECT * FROM sessions WHERE is_active = 1 ORDER BY login_at DESC LIMIT 1"
  );
  if (!sessionRow) return null;

  const session = mapSession(sessionRow);
  const accountRow = await queryOne<any>("SELECT * FROM accounts WHERE id = :id LIMIT 1", {
    ":id": session.accountId,
  });
  const storeRow = await queryOne<any>(
    "SELECT * FROM stores WHERE id = :id AND account_id = :account_id LIMIT 1",
    {
      ":id": session.storeId,
      ":account_id": session.accountId,
    }
  );

  if (!accountRow || !storeRow) {
    await clearSession();
    return null;
  }

  return {
    account: mapAccount(accountRow),
    store: mapStore(storeRow),
    session,
  };
}

export async function createAccount(
  ownerName: string,
  storeName: string,
  emailOrMobile: string,
  password: string
): Promise<AuthSessionBundle> {
  await initializeDatabase();

  const cleanOwner = ownerName.trim();
  const cleanStore = storeName.trim();
  if (!cleanOwner) throw new Error("Owner name is required.");
  if (!cleanStore) throw new Error("Store name is required.");

  const existing = await findAccountByContact(emailOrMobile);
  if (existing) {
    throw new Error("Account already exists for this email/mobile.");
  }

  const contact = normalizeContact(emailOrMobile);
  const passwordHash = await hashPassword(password);
  const accountId = makeId("acct");
  const storeId = makeId("store");
  const settingsId = makeId("stg");
  const createdAt = nowIso();
  const ts = nowMs();
  const sessionId = makeId("sess");
  const loginAt = createdAt;

  await runTransaction(db => {
    db.run(
      `INSERT INTO accounts (id, owner_name, email, mobile, password_hash, supabase_user_id, created_at, updated_at, is_dirty)
       VALUES (:id, :owner_name, :email, :mobile, :password_hash, :supabase_user_id, :created_at, :updated_at, 1)`,
      {
        ":id": accountId,
        ":owner_name": cleanOwner,
        ":email": contact.email,
        ":mobile": contact.mobile,
        ":password_hash": passwordHash,
        ":supabase_user_id": "",
        ":created_at": createdAt,
        ":updated_at": ts,
      }
    );

    db.run(
      `INSERT INTO stores (id, account_id, store_name, subscription_tier, created_at, updated_at, is_dirty)
       VALUES (:id, :account_id, :store_name, :subscription_tier, :created_at, :updated_at, 1)`,
      {
        ":id": storeId,
        ":account_id": accountId,
        ":store_name": cleanStore,
        ":subscription_tier": "free",
        ":created_at": createdAt,
        ":updated_at": ts,
      }
    );

    db.run(
      `INSERT INTO store_settings (
        id, store_id, management_pin_hash, language, theme, utang_enabled, pabili_enabled,
        gcash_number, maya_number, address, onboarding_complete, enable_barcode_scanner,
        enable_receipt_printer, updated_at, is_dirty
      )
      VALUES (
        :id, :store_id, NULL, :language, :theme, 1, 1, '', '', '', 0, 1, 0, :updated_at, 1
      )`,
      {
        ":id": settingsId,
        ":store_id": storeId,
        ":language": "fil",
        ":theme": "light",
        ":updated_at": ts,
      }
    );

    db.run("UPDATE sessions SET is_active = 0 WHERE is_active = 1");
    db.run(
      `INSERT INTO sessions (id, account_id, store_id, is_active, login_at)
       VALUES (:id, :account_id, :store_id, 1, :login_at)`,
      {
        ":id": sessionId,
        ":account_id": accountId,
        ":store_id": storeId,
        ":login_at": loginAt,
      }
    );
  });

  return {
    account: {
      id: accountId,
      ownerName: cleanOwner,
      email: contact.email,
      mobile: contact.mobile,
      passwordHash,
      supabaseUserId: "",
      createdAt,
    },
    store: {
      id: storeId,
      accountId,
      storeName: cleanStore,
      subscriptionTier: "free",
      createdAt,
    },
    session: {
      id: sessionId,
      accountId,
      storeId,
      isActive: true,
      loginAt,
    },
  };
}

export async function login(emailOrMobile: string, password: string): Promise<AuthSessionBundle> {
  await initializeDatabase();
  const account = await findAccountByContact(emailOrMobile);
  if (!account) {
    throw new Error("Account not found.");
  }

  const valid = await verifyPassword(password, account.passwordHash);
  if (!valid) {
    throw new Error("Invalid password.");
  }

  const store = await findStoreByAccount(account.id);
  if (!store) {
    throw new Error("Store not found for this account.");
  }

  const session = await createSession(account.id, store.id);
  return { account, store, session };
}

export async function logout() {
  await clearSession();
}

export async function setManagementPin(storeId: string, pin: string) {
  await initializeDatabase();
  if (!/^\d{4}$/.test(pin)) {
    throw new Error("Management PIN must be exactly 4 digits.");
  }
  const hash = await hashPassword(pin);
  const ts = nowMs();
  const id = makeId("stg");
  await run(
    `INSERT INTO store_settings (
      id, store_id, management_pin_hash, language, theme, utang_enabled, pabili_enabled,
      gcash_number, maya_number, address, onboarding_complete, enable_barcode_scanner,
      enable_receipt_printer, updated_at, is_dirty
    )
    VALUES (:id, :store_id, :management_pin_hash, 'fil', 'light', 1, 1, '', '', '', 0, 1, 0, :updated_at, 1)
    ON CONFLICT(store_id) DO UPDATE SET
      management_pin_hash = excluded.management_pin_hash,
      updated_at = excluded.updated_at,
      is_dirty = 1`,
    {
      ":id": id,
      ":store_id": storeId,
      ":management_pin_hash": hash,
      ":updated_at": ts,
    }
  );
  return hash;
}

export async function verifyManagementPinForStore(storeId: string, pin: string) {
  await initializeDatabase();
  const row = await queryOne<{ management_pin_hash: string | null }>(
    "SELECT management_pin_hash FROM store_settings WHERE store_id = :store_id LIMIT 1",
    { ":store_id": storeId }
  );
  if (!row?.management_pin_hash) return false;
  return verifyPassword(pin, row.management_pin_hash);
}

export async function getManagementPinHash(storeId: string) {
  await initializeDatabase();
  const row = await queryOne<{ management_pin_hash: string | null }>(
    "SELECT management_pin_hash FROM store_settings WHERE store_id = :store_id LIMIT 1",
    { ":store_id": storeId }
  );
  return row?.management_pin_hash || null;
}
