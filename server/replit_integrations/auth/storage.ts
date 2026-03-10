import { users, type User, type UpsertUser } from "@shared/models/auth";
import { db } from "../../db";
import { eq, and } from "drizzle-orm";

export interface IAuthStorage {
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
}

class AuthStorage implements IAuthStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    try {
      const [user] = await db
        .insert(users)
        .values(userData)
        .onConflictDoUpdate({
          target: users.id,
          set: {
            ...userData,
            updatedAt: new Date(),
          },
        })
        .returning();
      return user;
    } catch (error: any) {
      if (error?.code === "23505" && error?.constraint === "users_email_unique" && userData.email) {
        const [existing] = await db.select().from(users).where(eq(users.email, userData.email));
        if (existing && existing.id !== userData.id) {
          await db
            .update(users)
            .set({ email: null, updatedAt: new Date() })
            .where(eq(users.id, existing.id));

          const [user] = await db
            .insert(users)
            .values(userData)
            .onConflictDoUpdate({
              target: users.id,
              set: {
                ...userData,
                updatedAt: new Date(),
              },
            })
            .returning();
          return user;
        }
      }
      throw error;
    }
  }
}

export const authStorage = new AuthStorage();
