import { convexAuth } from "@convex-dev/auth/server";
import Google from "@auth/core/providers/google";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { type Id } from "./_generated/dataModel";

const ALLOWED_DOMAIN = "@ipupy.org.py";
const ADMIN_EMAIL = "administracion@ipupy.org.py";

function normalizeEmail(rawEmail: string): string {
  return rawEmail.trim().toLowerCase();
}

function extractConvexUserId(subject: string): string {
  const trimmedSubject = subject.trim();
  if (!trimmedSubject) {
    throw new Error("Identidad de usuario inválida");
  }
  const [userId] = trimmedSubject.split("|");
  if (!userId) {
    throw new Error("Identidad de usuario inválida");
  }
  return userId;
}

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Google({
      profile(profile) {
        const email = profile.email ? normalizeEmail(profile.email) : null;
        if (!email || !email.endsWith(ALLOWED_DOMAIN)) {
          throw new Error("Email domain not allowed");
        }

        return {
          id: profile.sub,
          email,
          name: profile.name,
          image: profile.picture,
        };
      },
    }),
  ],
});

type ProfileRole = "admin" | "fund_director" | "pastor" | "treasurer" | "church_manager" | "secretary";

type EnsureProfileResult =
  | {
      created: true;
      profileId: Id<"profiles">;
      role: ProfileRole;
      userId: Id<"users">;
      userEmailUpdated: boolean;
      userNameUpdated: boolean;
    }
  | {
      created: false;
      profileId: Id<"profiles">;
      role: ProfileRole;
      userId: Id<"users">;
      reactivated: boolean;
      updatedName: boolean;
      reassignedUserId: boolean;
      userEmailUpdated: boolean;
      userNameUpdated: boolean;
    };

function determineDefaultRole(email: string): ProfileRole {
  return email === ADMIN_EMAIL ? "admin" : "secretary";
}

export const ensureProfile = mutation({
  args: {
    full_name: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<EnsureProfileResult> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("No autenticado");
    }

    if (typeof identity.subject !== "string" || identity.subject.length === 0) {
      throw new Error("Identidad de usuario inválida");
    }

    const normalizedSubject = extractConvexUserId(identity.subject);
    const userId = await ctx.db.normalizeId("users", normalizedSubject);
    if (!userId) {
      throw new Error("Usuario de Convex Auth no encontrado");
    }

    const email = identity.email ? normalizeEmail(identity.email) : null;
    if (!email || !email.endsWith(ALLOWED_DOMAIN)) {
      throw new Error("Email domain not allowed");
    }

    const trimmedName = args.full_name?.trim();
    const identityName = identity.name?.trim();
    const resolvedFullName =
      (trimmedName && trimmedName.length > 0 ? trimmedName : undefined) ??
      (identityName && identityName.length > 0 ? identityName : undefined) ??
      null;

    const now = Date.now();

    const userRecord = await ctx.db.get(userId);
    if (!userRecord) {
      throw new Error("Usuario de Convex Auth no encontrado");
    }

    let userEmailUpdated = false;
    let userNameUpdated = false;
    const userUpdates: {
      email?: string;
      name?: string;
    } = {};

    if (userRecord.email !== email) {
      userUpdates.email = email;
      userEmailUpdated = true;
    }

    if (resolvedFullName && resolvedFullName.length > 0 && userRecord.name !== resolvedFullName) {
      userUpdates.name = resolvedFullName;
      userNameUpdated = true;
    }

    if (Object.keys(userUpdates).length > 0) {
      await ctx.db.patch(userRecord._id, userUpdates);
    }

    const profileByUser = await ctx.db
      .query("profiles")
      .withIndex("by_user_id", (q) => q.eq("user_id", userId))
      .first();

    const existingProfile =
      profileByUser ??
      (await ctx.db
        .query("profiles")
        .withIndex("by_email", (q) => q.eq("email", email))
        .first());

    if (existingProfile) {
      const updates: {
        updated_at: number;
        active?: boolean;
        full_name?: string;
        user_id?: Id<"users">;
        email?: string;
      } = {
        updated_at: now,
      };

      let reactivated = false;
      if (!existingProfile.active) {
        updates.active = true;
        reactivated = true;
      }

      let updatedName = false;
      if (
        resolvedFullName &&
        resolvedFullName.length > 0 &&
        resolvedFullName !== (existingProfile.full_name ?? null)
      ) {
        updates.full_name = resolvedFullName;
        updatedName = true;
      }

      let reassignedUserId = false;
      if (
        typeof existingProfile.user_id === "string" ||
        (existingProfile.user_id && existingProfile.user_id !== userId)
      ) {
        updates.user_id = userId;
        reassignedUserId = true;
      }

      if (existingProfile.email !== email) {
        updates.email = email;
      }

      await ctx.db.patch(existingProfile._id, updates);

      if (process.env.NODE_ENV === "development") {
        console.warn(
          `[Auth] ensureProfile: updated ${email} (reactivated=${reactivated}, updatedName=${updatedName}, reassignedUserId=${reassignedUserId})`
        );
      }

      return {
        created: false,
        profileId: existingProfile._id,
        role: existingProfile.role,
        userId,
        reactivated,
        updatedName,
        reassignedUserId,
        userEmailUpdated,
        userNameUpdated,
      };
    }

    const defaultRole = determineDefaultRole(email);

    const profileId = await ctx.db.insert("profiles", {
      user_id: userId,
      email,
      role: defaultRole,
      full_name: resolvedFullName ?? "",
      active: true,
      created_at: now,
      updated_at: now,
    });

    if (process.env.NODE_ENV === "development") {
      console.warn(
        `[Auth] ensureProfile: created ${email} (role=${defaultRole})`
      );
    }

    return {
      created: true,
      profileId,
      role: defaultRole,
      userId,
      userEmailUpdated,
      userNameUpdated,
    };
  },
});

export const getCurrentProfile = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const normalizedEmail = identity.email ? normalizeEmail(identity.email) : null;

    let normalizedUserId: Id<"users"> | null = null;
    if (typeof identity.subject === "string" && identity.subject.length > 0) {
      try {
        const normalizedSubject = extractConvexUserId(identity.subject);
        normalizedUserId = await ctx.db.normalizeId("users", normalizedSubject);
      } catch {
        normalizedUserId = null;
      }
    }

    let profile = null;

    if (normalizedUserId) {
      profile = await ctx.db
        .query("profiles")
        .withIndex("by_user_id", (q) => q.eq("user_id", normalizedUserId as Id<"users">))
        .first();
    }

    if (!profile && normalizedEmail) {
      profile = await ctx.db
        .query("profiles")
        .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
        .first();
    }

    if (!profile) {
      return null;
    }

    const church = profile.church_id ? await ctx.db.get(profile.church_id) : null;

    let userId: Id<"users"> | null = null;
    if (typeof profile.user_id === "string") {
      try {
        userId = await ctx.db.normalizeId("users", profile.user_id);
      } catch (error) {
        console.warn("[Auth] Unable to normalize legacy user_id", error);
      }
    } else {
      userId = profile.user_id;
    }

    const user = userId ? await ctx.db.get(userId) : null;

    const resolvedUserId = userId ?? profile.user_id;
    const serializedUserId =
      typeof resolvedUserId === "string" ? resolvedUserId : (resolvedUserId as Id<"users">);

    return {
      id: profile._id,
      userId: serializedUserId as unknown as string,
      email: profile.email ?? normalizedEmail ?? "",
      role: profile.role as ProfileRole,
      fullName: profile.full_name ?? null,
      active: profile.active,
      church: profile.church_id
        ? {
            id: profile.church_id,
            name: church?.name ?? null,
            city: church?.city ?? null,
          }
        : null,
      fundId: profile.fund_id ?? null,
      userName: user?.name ?? null,
      updatedAt: profile.updated_at,
    };
  },
});
