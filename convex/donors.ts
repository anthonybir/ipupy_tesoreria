import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { type Doc, type Id } from "./_generated/dataModel";
import { getAuthContext } from "./lib/auth";
import {
  filterByChurchAccess,
  requireChurchModify,
  requireMinRole,
} from "./lib/permissions";
import { ValidationError, NotFoundError } from "./lib/errors";

const DONOR_TYPES = ["individual", "family", "business"] as const;
const CONTRIBUTION_TYPES = ["diezmo", "ofrenda", "especial", "promesa"] as const;
const CONTRIBUTION_METHODS = [
  "efectivo",
  "transferencia",
  "cheque",
  "otro",
] as const;

type DonorType = (typeof DONOR_TYPES)[number];
type ContributionType = (typeof CONTRIBUTION_TYPES)[number];
type ContributionMethod = (typeof CONTRIBUTION_METHODS)[number];

type DonorResponse = {
  id: number | null;
  convex_id: Id<"donors">;
  church_id: number | null;
  church_convex_id: Id<"churches">;
  church_name: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  cedula: string | null;
  type: DonorType;
  active: boolean;
  contribution_count: number;
  total_contributions: number;
  created_at: string;
  updated_at: string;
};

type ContributionResponse = {
  id: number | null;
  convex_id: Id<"contributions">;
  donor_id: number | null;
  donor_convex_id: Id<"donors">;
  church_id: number | null;
  church_convex_id: Id<"churches">;
  church_name: string | null;
  date: string;
  amount: number;
  type: ContributionType;
  method: ContributionMethod;
  receipt_number: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type DonorSummary = {
  donor: DonorResponse;
  summary: {
    yearlyContributions: Array<{
      year: number;
      count: number;
      total: number;
      average: number;
    }>;
    contributionsByType: Array<{
      type: ContributionType;
      count: number;
      total: number;
    }>;
    recentContributions: ContributionResponse[];
  };
};

function toISOString(ms: number): string {
  return new Date(ms).toISOString();
}

async function loadChurchMap(
  ctx: Parameters<typeof getAuthContext>[0],
  churchIds: Id<"churches">[]
): Promise<Map<Id<"churches">, Doc<"churches">>> {
  const unique = Array.from(new Set(churchIds));
  const records = await Promise.all(unique.map((id) => ctx.db.get(id)));
  const map = new Map<Id<"churches">, Doc<"churches">>();
  records.forEach((record, index) => {
    const key = unique[index];
    if (!record || !key) return;
    map.set(key, record);
  });
  return map;
}

async function loadContributionsForDonor(
  ctx: Parameters<typeof getAuthContext>[0],
  donorId: Id<"donors">
): Promise<Doc<"contributions">[]> {
  return ctx.db
    .query("contributions")
    .withIndex("by_donor", (q) => q.eq("donor_id", donorId))
    .collect();
}

async function generateLegacyId(
  ctx: Parameters<typeof getAuthContext>[0],
  table: "donors" | "contributions"
): Promise<number> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = Number(`${Date.now()}${attempt}`);
    const existing = await ctx.db
      .query(table)
      .withIndex("by_supabase_id", (q) => q.eq("supabase_id", candidate))
      .first();
    if (!existing) {
      return candidate;
    }
  }
  throw new Error(`No se pudo generar un identificador legacy para ${table}`);
}

async function hydrateDonors(
  ctx: Parameters<typeof getAuthContext>[0],
  donors: Doc<"donors">[]
): Promise<DonorResponse[]> {
  if (donors.length === 0) return [];

  const churchMap = await loadChurchMap(
    ctx,
    donors.map((donor) => donor.church_id)
  );

  const response: DonorResponse[] = [];

  for (const donor of donors) {
    const contributions = await loadContributionsForDonor(ctx, donor._id);
    const contributionCount = contributions.length;
    const totalContributions = contributions.reduce(
      (sum, contribution) => sum + contribution.amount,
      0
    );

    const church = churchMap.get(donor.church_id) ?? null;

    response.push({
      id: donor.supabase_id ?? null,
      convex_id: donor._id,
      church_id: church?.supabase_id ?? null,
      church_convex_id: donor.church_id,
      church_name: church?.name ?? null,
      name: donor.name,
      email: donor.email ?? null,
      phone: donor.phone ?? null,
      address: donor.address ?? null,
      cedula: donor.cedula ?? null,
      type: donor.type,
      active: donor.active,
      contribution_count: contributionCount,
      total_contributions: totalContributions,
      created_at: toISOString(donor.created_at),
      updated_at: toISOString(donor.updated_at),
    });
  }

  return response;
}

function mapContribution(
  contribution: Doc<"contributions">,
  donor: Doc<"donors">,
  church: Doc<"churches"> | null
): ContributionResponse {
  return {
    id: contribution.supabase_id ?? null,
    convex_id: contribution._id,
    donor_id: donor.supabase_id ?? null,
    donor_convex_id: contribution.donor_id,
    church_id: church?.supabase_id ?? null,
    church_convex_id: contribution.church_id,
    church_name: church?.name ?? null,
    date: toISOString(contribution.date),
    amount: contribution.amount,
    type: contribution.type,
    method: contribution.method ?? "efectivo",
    receipt_number: contribution.receipt_number ?? null,
    notes: contribution.notes ?? null,
    created_at: toISOString(contribution.created_at),
    updated_at: toISOString(contribution.updated_at),
  };
}

export const list = query({
  args: {
    churchId: v.optional(v.id("churches")),
    limit: v.number(),
    offset: v.number(),
    sortColumn: v.optional(
      v.union(
        v.literal("apellido"),
        v.literal("nombre"),
        v.literal("created_at"),
        v.literal("updated_at"),
        v.literal("ci_ruc")
      )
    ),
    sortOrder: v.optional(v.union(v.literal("ASC"), v.literal("DESC"))),
    activeFlag: v.optional(v.boolean()),
    type: v.optional(
      v.union(
        v.literal("individual"),
        v.literal("family"),
        v.literal("business")
      )
    ),
  },
  handler: async (ctx, args): Promise<{ data: DonorResponse[]; total: number }> => {
    const auth = await getAuthContext(ctx);
    requireMinRole(auth, "church_manager");

    let donors = await ctx.db.query("donors").collect();

    if (args.churchId) {
      donors = donors.filter((donor) => donor.church_id === args.churchId);
    }

    donors = filterByChurchAccess(auth, donors);

    if (args.activeFlag !== undefined && args.activeFlag !== null) {
      donors = donors.filter((donor) => donor.active === args.activeFlag);
    }

    if (args.type) {
      donors = donors.filter((donor) => donor.type === args.type);
    }

    donors.sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }));

    const paged = donors.slice(args.offset, args.offset + args.limit);
    const hydrated = await hydrateDonors(ctx, paged);

    return {
      data: hydrated,
      total: donors.length,
    };
  },
});

export const search = query({
  args: {
    searchTerm: v.string(),
    churchId: v.optional(v.id("churches")),
  },
  handler: async (ctx, args): Promise<DonorResponse[]> => {
    const auth = await getAuthContext(ctx);
    requireMinRole(auth, "church_manager");

    const term = args.searchTerm.trim().toLowerCase();

    let donors = await ctx.db.query("donors").collect();

    if (args.churchId) {
      donors = donors.filter((donor) => donor.church_id === args.churchId);
    }

    donors = filterByChurchAccess(auth, donors);

    donors = donors.filter((donor) => {
      const fields = [
        donor.name,
        donor.email ?? "",
        donor.phone ?? "",
        donor.cedula ?? "",
      ];
      return fields.some((field) => field.toLowerCase().includes(term));
    });

    donors.sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }));

    const limited = donors.slice(0, 20);
    return hydrateDonors(ctx, limited);
  },
});

export const getSummary = query({
  args: {
    donorId: v.id("donors"),
  },
  handler: async (ctx, args): Promise<DonorSummary> => {
    const auth = await getAuthContext(ctx);
    requireMinRole(auth, "church_manager");

    const donor = await ctx.db.get(args.donorId);
    if (!donor) {
      throw new NotFoundError("Donor not found");
    }

    requireChurchModify(auth, donor.church_id);

    const [hydrated] = await hydrateDonors(ctx, [donor]);
    if (!hydrated) {
      throw new Error("No se pudo hidratar el donante");
    }
    const contributions = await loadContributionsForDonor(ctx, donor._id);

    const yearlyMap = new Map<number, { count: number; total: number }>();
    const typeMap = new Map<ContributionType, { count: number; total: number }>();

    for (const contribution of contributions) {
      const year = new Date(contribution.date).getFullYear();
      const yearly = yearlyMap.get(year) ?? { count: 0, total: 0 };
      yearly.count += 1;
      yearly.total += contribution.amount;
      yearlyMap.set(year, yearly);

      const type = contribution.type;
      const entry = typeMap.get(type) ?? { count: 0, total: 0 };
      entry.count += 1;
      entry.total += contribution.amount;
      typeMap.set(type, entry);
    }

    const yearlyContributions = Array.from(yearlyMap.entries())
      .map(([year, value]) => ({
        year,
        count: value.count,
        total: value.total,
        average: value.count === 0 ? 0 : value.total / value.count,
      }))
      .sort((a, b) => b.year - a.year);

    const contributionsByType = Array.from(typeMap.entries()).map(([type, value]) => ({
      type,
      count: value.count,
      total: value.total,
    }));

    const church = await ctx.db.get(donor.church_id);
    const contributionResponses = contributions
      .sort((a, b) => b.date - a.date)
      .slice(0, 10)
      .map((contribution) => mapContribution(contribution, donor, church ?? null));

    return {
      donor: hydrated,
      summary: {
        yearlyContributions,
        contributionsByType,
        recentContributions: contributionResponses,
      },
    };
  },
});

export const getContributions = query({
  args: {
    donorId: v.id("donors"),
  },
  handler: async (ctx, args): Promise<ContributionResponse[]> => {
    const auth = await getAuthContext(ctx);
    requireMinRole(auth, "church_manager");

    const donor = await ctx.db.get(args.donorId);
    if (!donor) {
      throw new NotFoundError("Donor not found");
    }

    requireChurchModify(auth, donor.church_id);

    const contributions = await ctx.db
      .query("contributions")
      .withIndex("by_donor", (q) => q.eq("donor_id", donor._id))
      .order("desc")
      .collect();

    const church = await ctx.db.get(donor.church_id);

    return contributions.map((contribution) =>
      mapContribution(contribution, donor, church ?? null)
    );
  },
});

export const findDonorByLegacyId = query({
  args: {
    supabase_id: v.number(),
  },
  handler: async (ctx, args) => {
    const donor = await ctx.db
      .query("donors")
      .withIndex("by_supabase_id", (q) => q.eq("supabase_id", args.supabase_id))
      .first();
    return donor?._id ?? null;
  },
});

export const createDonor = mutation({
  args: {
    church_id: v.id("churches"),
    name: v.string(),
    type: v.union(
      v.literal("individual"),
      v.literal("family"),
      v.literal("business")
    ),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
    cedula: v.optional(v.string()),
    created_by: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<DonorResponse> => {
    const auth = await getAuthContext(ctx);
    requireMinRole(auth, "church_manager");
    requireChurchModify(auth, args.church_id);

    if (!auth.churchId || auth.churchId !== args.church_id) {
      requireChurchModify(auth, args.church_id);
    }

    if (args.cedula) {
      const existing = await ctx.db
        .query("donors")
        .withIndex("by_cedula", (q) => q.eq("cedula", args.cedula))
        .first();
      if (existing && existing.church_id === args.church_id && existing.active) {
        throw new ValidationError("Ya existe un donante con esta cédula");
      }
    }

    const now = Date.now();
    const supabaseId = await generateLegacyId(ctx, "donors");
    const createdBy = args.created_by ?? auth.email;

    const donorId = await ctx.db.insert("donors", {
      supabase_id: supabaseId,
      church_id: args.church_id,
      name: args.name,
      ...(args.email ? { email: args.email } : {}),
      ...(args.phone ? { phone: args.phone } : {}),
      ...(args.address ? { address: args.address } : {}),
      ...(args.cedula ? { cedula: args.cedula } : {}),
      type: args.type,
      active: true,
      ...(createdBy ? { created_by: createdBy } : {}),
      created_at: now,
      updated_at: now,
    });

    const donorDoc = await ctx.db.get(donorId);
    if (!donorDoc) {
      throw new Error("No se pudo crear el donante");
    }

    const [donor] = await hydrateDonors(ctx, [donorDoc]);
    if (!donor) {
      throw new Error("No se pudo hidratar el donante");
    }
    return donor;
  },
});

export const createContribution = mutation({
  args: {
    donor_id: v.id("donors"),
    church_id: v.id("churches"),
    date: v.number(),
    amount: v.number(),
    type: v.union(
      v.literal("diezmo"),
      v.literal("ofrenda"),
      v.literal("especial"),
      v.literal("promesa")
    ),
    method: v.optional(
      v.union(
        v.literal("efectivo"),
        v.literal("transferencia"),
        v.literal("cheque"),
        v.literal("otro")
      )
    ),
    receipt_number: v.optional(v.string()),
    notes: v.optional(v.string()),
    created_by: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<ContributionResponse> => {
    const auth = await getAuthContext(ctx);
    requireMinRole(auth, "treasurer");
    requireChurchModify(auth, args.church_id);

    const donor = await ctx.db.get(args.donor_id);
    if (!donor) {
      throw new NotFoundError("Donor not found");
    }

    if (donor.church_id !== args.church_id) {
      throw new ValidationError("El donante pertenece a otra iglesia");
    }

    const now = Date.now();
    const supabaseId = await generateLegacyId(ctx, "contributions");
    const receipt =
      args.receipt_number ?? `REC-${donor.supabase_id ?? "CONVEX"}-${now.toString(36).toUpperCase()}`;
    const createdBy = args.created_by ?? auth.email;

    const contributionId = await ctx.db.insert("contributions", {
      supabase_id: supabaseId,
      donor_id: args.donor_id,
      church_id: args.church_id,
      date: args.date,
      amount: args.amount,
      type: args.type,
      ...(args.method ? { method: args.method } : {}),
      receipt_number: receipt,
      ...(args.notes ? { notes: args.notes } : {}),
      ...(createdBy ? { created_by: createdBy } : {}),
      created_at: now,
      updated_at: now,
    });

    const contributionDoc = await ctx.db.get(contributionId);
    if (!contributionDoc) {
      throw new Error("No se pudo registrar la contribución");
    }

    const church = await ctx.db.get(args.church_id);
    return mapContribution(contributionDoc, donor, church ?? null);
  },
});

export const updateDonor = mutation({
  args: {
    donor_id: v.id("donors"),
    payload: v.object({
      name: v.optional(v.string()),
      email: v.optional(v.string()),
      phone: v.optional(v.string()),
      address: v.optional(v.string()),
      cedula: v.optional(v.string()),
      type: v.optional(v.union(...DONOR_TYPES.map((t) => v.literal(t)))),
      active: v.optional(v.boolean()),
    }),
  },
  handler: async (ctx, args): Promise<DonorResponse> => {
    const auth = await getAuthContext(ctx);
    requireMinRole(auth, "church_manager");

    const donor = await ctx.db.get(args.donor_id);
    if (!donor) {
      throw new NotFoundError("Donor not found");
    }

    requireChurchModify(auth, donor.church_id);

    const updates: Partial<Doc<"donors">> = {
      updated_at: Date.now(),
    };

    if (args.payload.name !== undefined) updates.name = args.payload.name;
    if (args.payload.email !== undefined) updates.email = args.payload.email ?? undefined;
    if (args.payload.phone !== undefined) updates.phone = args.payload.phone ?? undefined;
    if (args.payload.address !== undefined) updates.address = args.payload.address ?? undefined;
    if (args.payload.cedula !== undefined) updates.cedula = args.payload.cedula ?? undefined;
    if (args.payload.type !== undefined) updates.type = args.payload.type;
    if (args.payload.active !== undefined) updates.active = args.payload.active;

    await ctx.db.patch(args.donor_id, updates);

    const updated = await ctx.db.get(args.donor_id);
    if (!updated) {
      throw new Error("No se pudo actualizar el donante");
    }

    const [hydrated] = await hydrateDonors(ctx, [updated]);
    if (!hydrated) {
      throw new Error("No se pudo hidratar el donante");
    }
    return hydrated;
  },
});

export const updateContribution = mutation({
  args: {
    contribution_id: v.id("contributions"),
    payload: v.object({
      date: v.optional(v.number()),
      amount: v.optional(v.number()),
      type: v.optional(v.union(...CONTRIBUTION_TYPES.map((t) => v.literal(t)))),
      method: v.optional(v.union(...CONTRIBUTION_METHODS.map((t) => v.literal(t)))),
      receipt_number: v.optional(v.string()),
      notes: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args): Promise<ContributionResponse> => {
    const auth = await getAuthContext(ctx);
    requireMinRole(auth, "treasurer");

    const contribution = await ctx.db.get(args.contribution_id);
    if (!contribution) {
      throw new NotFoundError("Contribution not found");
    }

    const donor = await ctx.db.get(contribution.donor_id);
    if (!donor) {
      throw new NotFoundError("Donor not found");
    }

    requireChurchModify(auth, donor.church_id);

    const updates: Partial<Doc<"contributions">> = {
      updated_at: Date.now(),
    };

    if (args.payload.date !== undefined) updates.date = args.payload.date;
    if (args.payload.amount !== undefined) updates.amount = args.payload.amount;
    if (args.payload.type !== undefined) updates.type = args.payload.type;
    if (args.payload.method !== undefined) updates.method = args.payload.method;
    if (args.payload.receipt_number !== undefined) updates.receipt_number = args.payload.receipt_number ?? undefined;
    if (args.payload.notes !== undefined) updates.notes = args.payload.notes ?? undefined;

    await ctx.db.patch(args.contribution_id, updates);

    const updatedContribution = await ctx.db.get(args.contribution_id);
    if (!updatedContribution) {
      throw new Error("No se pudo actualizar la contribución");
    }

    const church = await ctx.db.get(donor.church_id);
    return mapContribution(updatedContribution, donor, church ?? null);
  },
});

export const deleteContribution = mutation({
  args: {
    contribution_id: v.id("contributions"),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx);
    requireMinRole(auth, "treasurer");

    const contribution = await ctx.db.get(args.contribution_id);
    if (!contribution) {
      throw new NotFoundError("Contribution not found");
    }

    const donor = await ctx.db.get(contribution.donor_id);
    if (!donor) {
      throw new NotFoundError("Donor not found");
    }

    requireChurchModify(auth, donor.church_id);

    await ctx.db.delete(args.contribution_id);

    return { success: true } as const;
  },
});

export const deactivateDonor = mutation({
  args: {
    donor_id: v.id("donors"),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx);
    requireMinRole(auth, "church_manager");

    const donor = await ctx.db.get(args.donor_id);
    if (!donor) {
      throw new NotFoundError("Donor not found");
    }

    requireChurchModify(auth, donor.church_id);

    await ctx.db.patch(args.donor_id, {
      active: false,
      updated_at: Date.now(),
    });

    return { success: true } as const;
  },
});
