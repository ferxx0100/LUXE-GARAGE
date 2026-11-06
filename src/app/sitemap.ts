import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/config";

// Solo las páginas públicas.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/privacidad`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
