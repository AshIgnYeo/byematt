import type { MetadataRoute } from "next";

/**
 * Next serves this at /manifest.webmanifest and links it from every page.
 *
 * `display: standalone` is not decoration: iOS only delivers web push to a PWA
 * that was added to the home screen, and it only offers that for a manifest
 * that asks for it.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ByeMatt",
    short_name: "ByeMatt",
    description: "Catch Matt off guard. He drinks.",
    // Signed-in players land straight on the feed; anyone else is bounced to
    // the join screen from there.
    start_url: "/feed",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#08090b",
    theme_color: "#08090b",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
