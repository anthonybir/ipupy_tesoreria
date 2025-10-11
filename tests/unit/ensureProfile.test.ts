jest.mock("@convex-dev/auth/server", () => ({
  convexAuth: () => ({
    auth: {},
    signIn: jest.fn(),
    signOut: jest.fn(),
    store: {},
    isAuthenticated: jest.fn(),
  }),
}), { virtual: true });

jest.mock("@auth/core/providers/google", () => ({
  __esModule: true,
  default: () => ({}),
}), { virtual: true });

jest.mock("../../convex/_generated/server", () => ({
  mutation: (config: unknown) => config,
  query: (config: unknown) => config,
}), { virtual: true });

import { ensureProfile } from "../../convex/auth";
import type { MutationCtx } from "../../convex/_generated/server";
import type { Id } from "../../convex/_generated/dataModel";

type TableRow = { _id: Id<string> } & Record<string, unknown>;

type Tables = Record<string, TableRow[]>;

class MockDb {
  private tables: Tables;

  constructor(initial: Tables) {
    this.tables = {};
    for (const [table, rows] of Object.entries(initial)) {
      this.tables[table] = rows.map((row) => ({ ...row })) as TableRow[];
    }
  }

  query(table: string) {
    const rows = this.tables[table] ?? [];

    return {
      withIndex: (_index: string, cb: (q: { eq: (field: string, value: unknown) => void }) => void) => {
        let criteriaField: string | null = null;
        let criteriaValue: unknown;
        cb({
          eq: (field: string, value: unknown) => {
            criteriaField = field;
            criteriaValue = value;
          },
        });

        const filtered =
          criteriaField === null
            ? rows
            : rows.filter((row) => row[criteriaField as keyof TableRow] === criteriaValue);

        return {
          first: async () => filtered[0] ?? null,
        };
      },
    };
  }

  async insert(table: string, value: Record<string, unknown>) {
    const id = ((value._id as string | undefined) ?? `${table}|${Math.random().toString(36).slice(2, 10)}`) as Id<string>;
    const row = { ...value, _id: id } as TableRow;
    this.tables[table] = [...(this.tables[table] ?? []), row];
    return id;
  }

  async patch(id: Id<string>, updates: Record<string, unknown>) {
    const table = this.findTableById(id);
    if (!table) return;
    const rows = this.tables[table];
    const index = rows.findIndex((row) => row._id === id);
    if (index >= 0) {
      rows[index] = { ...rows[index], ...updates };
    }
  }

  async get(id: Id<string>) {
    const table = this.findTableById(id);
    if (!table) return null;
    return this.tables[table].find((row) => row._id === id) ?? null;
  }

  async normalizeId(table: string, subject: string) {
    const rows = this.tables[table] ?? [];
    const match = rows.find((row) => row._id === subject);
    return match ? (subject as Id<string>) : null;
  }

  getTable(table: string) {
    return this.tables[table] ?? [];
  }

  private findTableById(id: Id<string>) {
    if (typeof id === "string" && id.includes("|")) {
      return id.split("|")[0] ?? null;
    }

    for (const [table, rows] of Object.entries(this.tables)) {
      if (rows.some((row) => row._id === id)) {
        return table;
      }
    }

    return null;
  }
}

function createCtx(db: MockDb, identity: { subject: Id<string>; email: string; name?: string }) {
  return {
    auth: {
      getUserIdentity: jest.fn().mockResolvedValue(identity),
    },
    db,
  } as unknown as MutationCtx;
}

describe("ensureProfile mutation", () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date("2025-10-09T22:00:00Z"));
    jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("creates a profile for a new Convex Auth user and assigns secretary role", async () => {
    const userId = "users|new-user" as Id<string>;
    const tables: Tables = {
      users: [{
        _id: userId,
        email: "new.user@ipupy.org.py",
        name: "New User",
      } as TableRow],
      profiles: [],
    };

    const db = new MockDb(tables);
    const ctx = createCtx(db, {
      subject: userId,
      email: "new.user@ipupy.org.py",
      name: "New User",
    });

    const result = await ensureProfile.handler(ctx, {});

    expect(result.created).toBe(true);
    expect(result.role).toBe("secretary");
    expect(result.userId).toBe(userId);

    const profiles = db.getTable("profiles");
    expect(profiles).toHaveLength(1);
    const profile = profiles[0];
    expect(profile.email).toBe("new.user@ipupy.org.py");
    expect(profile.role).toBe("secretary");
    expect(profile.active).toBe(true);
    expect(profile.user_id).toBe(userId);
  });

  it("reactivates an inactive profile without creating duplicates", async () => {
    const userId = "users|existing" as Id<string>;
    const profileId = "profiles|existing" as Id<string>;

    const tables: Tables = {
      users: [{
        _id: userId,
        email: "existing.user@ipupy.org.py",
        name: "Existing User",
      } as TableRow],
      profiles: [{
        _id: profileId,
        user_id: userId,
        email: "existing.user@ipupy.org.py",
        role: "secretary",
        active: false,
        full_name: "Existing User",
        created_at: Date.now() - 1_000,
        updated_at: Date.now() - 1_000,
      } as TableRow],
    };

    const db = new MockDb(tables);
    const ctx = createCtx(db, {
      subject: userId,
      email: "existing.user@ipupy.org.py",
      name: "Existing User",
    });

    const result = await ensureProfile.handler(ctx, {});

    expect(result.created).toBe(false);
    expect(result.reactivated).toBe(true);
    expect(result.profileId).toBe(profileId);

    const profiles = db.getTable("profiles");
    expect(profiles).toHaveLength(1);
    const profile = profiles[0];
    expect(profile.active).toBe(true);
    expect(profile.updated_at).toBe(Date.now());
  });

  it("assigns admin role for administracion@ipupy.org.py", async () => {
    const userId = "users|admin" as Id<string>;
    const tables: Tables = {
      users: [{
        _id: userId,
        email: "administracion@ipupy.org.py",
        name: "Admin User",
      } as TableRow],
      profiles: [],
    };

    const db = new MockDb(tables);
    const ctx = createCtx(db, {
      subject: userId,
      email: "administracion@ipupy.org.py",
      name: "Admin User",
    });

    const result = await ensureProfile.handler(ctx, {});

    expect(result.created).toBe(true);
    expect(result.role).toBe("admin");
  });
});
