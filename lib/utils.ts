import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { ActionCtx, MutationCtx, QueryCtx } from "@/convex/_generated/server";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

type ConvexCtx = MutationCtx | QueryCtx | ActionCtx;

export async function withErrorHandler<T>(
    operation: () => Promise<T>,
    errorMessage: string = "Operation failed"
): Promise<T> {
    try {
        return await operation();
    } catch (error) {
        throw new Error(`${errorMessage}: ${(error as Error).message}`);
    }
}

// Helper specifically for authenticated operations
export async function withAuth<T>(
    ctx: ConvexCtx,
    operation: (userId: string) => Promise<T>
): Promise<T> {
    return withErrorHandler(async () => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Unauthorized");
        }
        return await operation(identity.subject);
    }, "Authentication failed");
}