import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { nextCookies } from "better-auth/next-js";
import { phoneNumber } from "better-auth/plugins";
import { getDb } from "@/lib/db";
import { deliverBuyerOtp } from "@/lib/otp";
import * as schema from "@/drizzle/schema";

const googleClientId = process.env.GOOGLE_CLIENT_ID?.trim();
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
const googleEnabled = Boolean(googleClientId && googleClientSecret);

function createAuth() {
  return betterAuth({
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL,
    database: drizzleAdapter(getDb(), {
      provider: "pg",
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
      },
    }),

    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 3,
    },

    user: {
      additionalFields: {
        role: {
          type: "string",
          required: false,
          defaultValue: "buyer",
          input: false,
        },
      },
    },

    socialProviders: googleEnabled
      ? {
          google: {
            clientId: googleClientId as string,
            clientSecret: googleClientSecret as string,
          },
        }
      : undefined,

    databaseHooks: {
      user: {
        create: {
          before: async (user) => ({
            data: {
              ...user,
              role: "buyer",
            },
          }),
        },
      },
    },

    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: googleEnabled ? ["google"] : [],
      },
    },

    plugins: [
      phoneNumber({
        sendOTP: async ({ phoneNumber, code }) => {
          await deliverBuyerOtp({ phoneNumber, code });
        },

        signUpOnVerification: {
          getTempEmail: (phoneNumber) => `${phoneNumber}@sparelink.local`,
          getTempName: (phoneNumber) => phoneNumber,
        },
      }),
      nextCookies(),
    ],
  });
}

type Auth = ReturnType<typeof createAuth>;

let authInstance: Auth | undefined;

/**
 * Better Auth must not call getDb() at module import. Next.js evaluates this
 * module during `next build` collect-page-data, and GitHub Actions has no
 * DATABASE_URL. Runtime still creates one cached instance on first use.
 */
export function getAuth(): Auth {
  if (!authInstance) {
    authInstance = createAuth();
  }
  return authInstance;
}

export const auth: Auth = new Proxy({} as Auth, {
  get(_target, property, receiver) {
    const instance = getAuth();
    const value = Reflect.get(instance, property, receiver);
    if (typeof value === "function") {
      return value.bind(instance);
    }
    return value;
  },
  has(_target, property) {
    return property in getAuth();
  },
});
