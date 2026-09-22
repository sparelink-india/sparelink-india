import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { nextCookies } from "better-auth/next-js";
import { phoneNumber } from "better-auth/plugins";
import { getDb } from "@/lib/db";
import { deliverBuyerOtp } from "@/lib/otp";
import { sessionCookieAttributes } from "@/lib/access-control";
import * as schema from "@/drizzle/schema";

const googleClientId = process.env.GOOGLE_CLIENT_ID?.trim();
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
const googleEnabled = Boolean(googleClientId && googleClientSecret);

export const auth = betterAuth({
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

  advanced: {
    defaultCookieAttributes: sessionCookieAttributes(
      process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL,
    ),
  },

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
