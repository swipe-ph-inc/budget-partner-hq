import type { MetadataRoute } from "next";
import { absolutizeAppOrigin } from "@/lib/app-origin";

export default function robots(): MetadataRoute.Robots {
  const base = absolutizeAppOrigin(process.env.NEXT_PUBLIC_APP_URL);

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/dashboard", "/accounts", "/transactions", "/profile"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
