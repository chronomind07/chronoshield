import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/login",
          "/register",
          "/forgot-password",
          "/reset-password",
          "/privacidad",
          "/terminos",
          "/contacto",
        ],
        disallow: ["/dashboard/", "/dashboard"],
      },
    ],
    sitemap: "https://chronoshield.eu/sitemap.xml",
    host: "https://chronoshield.eu",
  };
}
