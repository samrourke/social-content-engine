/* ============================================================
   SITE CONFIG  —  Fill this in first on every new project.
   Metadata, sitemap, robots, nav, footer and structured data
   all read from here, so nothing else needs hunting down.
   ============================================================ */

export const site = {
  name: "Content Farm",
  // Used as the default <title> on the home page. Lead with what
  // the business does + where, then the brand name.
  title: "Content Farm — Content discovery and review dashboard",
  // ~150–160 characters. Written for humans; shown in search results.

  // Production URL, no trailing slash. Drives canonicals, OG urls & sitemap.
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://www.example.co.uk",

  locale: "en_GB",
  lang: "en-GB",

  // Browser UI colour on mobile — usually matches --background.
  themeColor: "#344e41",

  // Leave any blank to omit.
  address: {
    street: "",
    locality: "",
    postcode: "",
    country: "",
  },

  // Full URLs. Linked in the footer and listed as `sameAs` for Google.
  socials: {
    instagram: "",
    facebook: "",
    linkedin: "",
    tiktok: "",
  },

  nav: [
    { name: "Content Review", href: "/", id: "review" },
    { name: "Instagram Review", href: "/instagram", id: "instagram" },
    { name: "Dashboard", href: "/tiktok", id: "dashboard" },
    { name: "Calendar", href: "/calendar", id: "calendar" },
  ],
};
