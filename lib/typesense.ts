import Typesense from "typesense";

const host = process.env.TYPESENSE_HOST;

export const typesense = host
  ? new Typesense.Client({
      nodes: [
        {
          host,
          port: Number(process.env.TYPESENSE_PORT ?? 443),
          protocol: process.env.TYPESENSE_PROTOCOL ?? "https",
        },
      ],
      apiKey: process.env.TYPESENSE_API_KEY ?? "",
      connectionTimeoutSeconds: 5,
    })
  : null;
