import type { MetadataRoute } from "next";
import { absolutizeAppOrigin } from "@/lib/app-origin";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = absolutizeAppOrigin(process.env.NEXT_PUBLIC_APP_URL);
  const now = new Date();

  return [
    { url: `${base}/login`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/pricing`, lastModified: now, changeFrequency: "weekly", priority: 0.85 },
    { url: `${base}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/refund-policy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/signup`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
  ];
}
