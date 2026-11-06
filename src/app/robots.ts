import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/config";

// Google indexa la página pública; nunca el panel, la API ni los enlaces secretos (recibos, cuenta del socio).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: ["/", "/privacidad"], disallow: ["/admin", "/api/", "/reserva/", "/socio"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
