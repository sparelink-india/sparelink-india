import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { phoneNumber } from "better-auth/plugins";
import { getDb } from "@/lib/db";

export const auth = betterAuth({
  database: drizzleAdapter(getDb(), {
    provider: "pg",
  }),

user: {
  additionalFields: {
    role: {
      type: ["buyer", "dealer", "admin"],
      required: false,
      defaultValue: "buyer",
      input: false,
    },
  },
},

  plugins: [
    phoneNumber({
      sendOTP: async ({ phoneNumber, code }) => {
        console.log(`OTP for ${phoneNumber}: ${code}`);
      },

      signUpOnVerification: {
        getTempEmail: (phoneNumber) => `${phoneNumber}@sparelink.local`,
        getTempName: (phoneNumber) => phoneNumber,
      },
    }),
  ],
});