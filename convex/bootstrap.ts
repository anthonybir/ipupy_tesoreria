/**
 * Bootstrap Module - One-Time Setup
 *
 * This file contains mutations for initial system setup.
 * These functions should only be run during initial deployment.
 */

import { mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Bootstrap admin profile
 *
 * Creates or updates the administracion@ipupy.org.py profile with admin role.
 * This is a one-time setup function that bypasses normal auth requirements.
 */
export const setupAdminProfile = mutation({
  args: {
    user_id: v.string(), // Convex Auth user ID
    email: v.string(),
    full_name: v.string(),
  },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();

    // Only allow setting up the main admin account
    if (email !== "administracion@ipupy.org.py") {
      throw new Error("This function can only be used for the main admin account");
    }

    // Normalize user_id to Id<"users">
    const userId = await ctx.db.normalizeId("users", args.user_id);
    if (!userId) {
      throw new Error("Invalid user_id");
    }

    const now = Date.now();

    // Check if profile already exists
    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    if (existing) {
      // Update existing profile
      await ctx.db.patch(existing._id, {
        user_id: userId,
        role: "admin",
        full_name: args.full_name,
        active: true,
        updated_at: now,
      });

      // eslint-disable-next-line no-console
      console.log("[Bootstrap] Updated admin profile:", existing._id);

      return {
        success: true,
        message: "Admin profile updated successfully",
        profileId: existing._id,
        wasUpdated: true,
      };
    }

    // Create new profile
    const profileId = await ctx.db.insert("profiles", {
      user_id: userId,
      email,
      role: "admin",
      full_name: args.full_name,
      active: true,
      created_at: now,
      updated_at: now,
    });

    // eslint-disable-next-line no-console
    console.log("[Bootstrap] Created admin profile:", profileId);

    return {
      success: true,
      message: "Admin profile created successfully",
      profileId,
      wasUpdated: false,
    };
  },
});

/**
 * Get user ID by email from Convex Auth users table
 * Helper to find the user_id needed for setupAdminProfile
 */
export const getUserIdByEmail = mutation({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();

    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .first();

    if (!user) {
      return {
        found: false,
        message: "No user found with that email in Convex Auth",
      };
    }

    return {
      found: true,
      user_id: user._id,
      email: user.email,
      name: user.name,
    };
  },
});

/**
 * Check if profile exists by email (no auth required)
 * Helper for debugging
 */
export const checkProfileByEmail = mutation({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    if (!profile) {
      return {
        found: false,
        message: "No profile found with that email",
      };
    }

    return {
      found: true,
      profile: {
        id: profile._id,
        email: profile.email,
        role: profile.role,
        full_name: profile.full_name,
        active: profile.active,
        user_id: profile.user_id,
        created_at: profile.created_at,
        updated_at: profile.updated_at,
      },
    };
  },
});
