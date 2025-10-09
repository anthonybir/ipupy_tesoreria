/**
 * Authentication mutations for Convex.
 *
 * Phase 2 (WS-2) – Auto-provisioning of user profiles when users sign in
 * through NextAuth. Ensures that every @ipupy.org.py account has a matching
 * Convex profile with the correct default role.
 */

import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { type Id } from "./_generated/dataModel";

const ALLOWED_DOMAIN = "@ipupy.org.py";
const ADMIN_EMAIL = "administracion@ipupy.org.py";

type ProfileRole = "admin" | "fund_director" | "pastor" | "treasurer" | "church_manager" | "secretary";

type EnsureProfileResult =
  | {
      created: true;
      profileId: Id<"profiles">;
      role: ProfileRole;
    }
  | {
      created: false;
      profileId: Id<"profiles">;
      role: ProfileRole;
      reactivated: boolean;
      updatedName: boolean;
    };

function normalizeEmail(rawEmail: string): string {
  return rawEmail.trim().toLowerCase();
}

function determineDefaultRole(email: string): ProfileRole {
  return email === ADMIN_EMAIL ? "admin" : "secretary";
}

export const ensureProfile = mutation({
  args: {
    email: v.string(),
    full_name: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<EnsureProfileResult> => {
    const normalizedEmail = normalizeEmail(args.email);

    if (!normalizedEmail.endsWith(ALLOWED_DOMAIN)) {
      throw new Error("Email domain not allowed");
    }

    const trimmedName = args.full_name?.trim();
    const now = Date.now();

    const existingProfile = await ctx.db
      .query("profiles")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .first();

    if (existingProfile) {
      const updates: {
        updated_at: number;
        active?: boolean;
        full_name?: string;
      } = {
        updated_at: now,
      };

      let reactivated = false;
      if (!existingProfile.active) {
        updates.active = true;
        reactivated = true;
      }

      let updatedName = false;
      if (typeof trimmedName === "string" && trimmedName.length > 0 && trimmedName !== existingProfile.full_name) {
        updates.full_name = trimmedName;
        updatedName = true;
      }

      await ctx.db.patch(existingProfile._id, updates);

      if (process.env.NODE_ENV === "development") {
        console.warn(
          `[Auth] ensureProfile: updated ${normalizedEmail} (reactivated=${reactivated}, updatedName=${updatedName})`
        );
      }

      return {
        created: false,
        profileId: existingProfile._id,
        role: existingProfile.role,
        reactivated,
        updatedName,
      };
    }

    const defaultRole = determineDefaultRole(normalizedEmail);

    const profileData: {
      user_id: string;
      email: string;
      role: EnsureProfileResult["role"];
      active: boolean;
      created_at: number;
      updated_at: number;
      full_name?: string;
    } = {
      user_id: normalizedEmail,
      email: normalizedEmail,
      role: defaultRole,
      active: true,
      created_at: now,
      updated_at: now,
    };

    if (typeof trimmedName === "string" && trimmedName.length > 0) {
      profileData.full_name = trimmedName;
    }

    const profileId = await ctx.db.insert("profiles", profileData);

    if (process.env.NODE_ENV === "development") {
      console.warn(`[Auth] ensureProfile: created ${normalizedEmail} (role=${defaultRole})`);
    }

    return {
      created: true,
      profileId,
      role: defaultRole,
    };
  },
});

