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
        src: "/icons/sparelink-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/sparelink-favicon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
