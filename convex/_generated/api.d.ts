/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as admin from "../admin.js";
import type * as auth from "../auth.js";
import type * as churches from "../churches.js";
import type * as fundEvents from "../fundEvents.js";
import type * as funds from "../funds.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_errors from "../lib/errors.js";
import type * as lib_permissions from "../lib/permissions.js";
import type * as lib_validators from "../lib/validators.js";
import type * as providers from "../providers.js";
import type * as reports from "../reports.js";
import type * as transactions from "../transactions.js";
import type * as updateForeignKeys from "../updateForeignKeys.js";
import type * as validate from "../validate.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  auth: typeof auth;
  churches: typeof churches;
  fundEvents: typeof fundEvents;
  funds: typeof funds;
  "lib/auth": typeof lib_auth;
  "lib/errors": typeof lib_errors;
  "lib/permissions": typeof lib_permissions;
  "lib/validators": typeof lib_validators;
  providers: typeof providers;
  reports: typeof reports;
  transactions: typeof transactions;
  updateForeignKeys: typeof updateForeignKeys;
  validate: typeof validate;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
