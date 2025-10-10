import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { users, organizations, memberships } from "@shared/schema";

type DbUser = typeof users.$inferSelect;
type DbOrganization = typeof organizations.$inferSelect;
type DbMembership = typeof memberships.$inferSelect;

export interface AuthSuccess {
  user: DbUser;
  organization: DbOrganization;
  memberships: DbMembership[];
}

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export interface RegisterAccountInput {
  organizationName: string;
  organizationSlug?: string | null;
  email: string;
  password: string;
  userName?: string | null;
}

export class AuthService {
  async authenticateWithPassword(login: string, password: string): Promise<AuthSuccess | null> {
    if (!db) {
      throw new Error("Database connection is not initialized");
    }
    const normalizedLogin = login.trim().toLowerCase();

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedLogin));

    if (!user) {
      return null;
    }

    if (!user.isActive) {
      return null;
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      return null;
    }

    const [organization] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, user.organizationId));

    if (!organization) {
      return null;
    }

    const userMemberships = await db
      .select()
      .from(memberships)
      .where(eq(memberships.userId, user.id));

    return {
      user,
      organization,
      memberships: userMemberships,
    };
  }

  async registerAccount(input: RegisterAccountInput): Promise<AuthSuccess> {
    if (!db) {
      throw new Error("Database connection is not initialized");
    }

    const organizationName = input.organizationName.trim();
    if (!organizationName) {
      throw new Error("Organization name is required");
    }

    const normalizedEmail = input.email.trim().toLowerCase();
    const desiredSlug = input.organizationSlug?.trim();
    const baseSlug = slugify(desiredSlug && desiredSlug.length > 0 ? desiredSlug : organizationName);

    if (!baseSlug) {
      throw new Error("Organization slug could not be generated");
    }

    const passwordHash = await bcrypt.hash(input.password, 12);

    return await db.transaction(async (tx) => {
      const [existingUser] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, normalizedEmail));

      if (existingUser) {
        throw new Error("A user with this email already exists");
      }

      let uniqueSlug = baseSlug;
      let suffix = 1;
      let slugIsTaken = true;
      while (slugIsTaken) {
        const [slugConflict] = await tx
          .select({ id: organizations.id })
          .from(organizations)
          .where(eq(organizations.slug, uniqueSlug));
        slugIsTaken = Boolean(slugConflict);
        if (slugIsTaken) {
          suffix += 1;
          uniqueSlug = `${baseSlug}-${suffix}`;
        }
      }

      const [organization] = await tx
        .insert(organizations)
        .values({
          name: organizationName,
          slug: uniqueSlug,
        })
        .returning();

      const [user] = await tx
        .insert(users)
        .values({
          organizationId: organization.id,
          email: normalizedEmail,
          passwordHash,
          name: input.userName?.trim() || null,
          isActive: true,
          isSuperAdmin: false,
        })
        .returning();

      const [membership] = await tx
        .insert(memberships)
        .values({
          organizationId: organization.id,
          userId: user.id,
          role: "admin",
        })
        .returning();

      return {
        user,
        organization,
        memberships: [membership],
      };
    });
  }

  async getUserProfile(userId: number): Promise<AuthSuccess | null> {
    if (!db) {
      throw new Error("Database connection is not initialized");
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId));

    if (!user) {
      return null;
    }

    const [organization] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, user.organizationId));

    if (!organization) {
      return null;
    }

    const userMemberships = await db
      .select()
      .from(memberships)
      .where(eq(memberships.userId, user.id));

    return {
      user,
      organization,
      memberships: userMemberships,
    };
  }
}

export const authService = new AuthService();
