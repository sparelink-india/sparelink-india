import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SpareLink India",
    short_name: "SpareLink",
    description:
      "SpareLink India is the digital sales platform for Hind Motors, Ambaji Traders and India Sales.",
    start_url: "/",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#7a1233",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "48x48",
        type: "image/x-icon",
      },
    ],
  };
}
