import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { phoneNumber } from "better-auth/plugins";
import { getDb } from "@/lib/db";
import { deliverBuyerOtp } from "@/lib/otp";
import * as schema from "@/drizzle/schema";

export const auth = betterAuth({
  database: drizzleAdapter(getDb(), {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),

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
  ],
});
