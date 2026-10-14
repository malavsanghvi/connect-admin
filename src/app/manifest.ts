import type { MetadataRoute } from "next";
import { PRODUCT_NAME, kitColor } from "@/lib/brand-kit";

// The web manifest: the name, theme colour and the kit's own mark files (public/brand). `display: "browser"` keeps
// "Add to Home Screen" a plain shortcut that opens in the browser, as the app behaved before it had a manifest.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${PRODUCT_NAME} Admin`,
    short_name: `${PRODUCT_NAME} Admin`,
    description: "Event check-in, the kitchen display and day-of tools for your organization, on Weaver.",
    start_url: "/",
    display: "browser",
    background_color: kitColor("canvas"),
    theme_color: kitColor("navy"),
    icons: [
      { src: "/brand/weaver-mark-256.png", sizes: "256x256", type: "image/png" },
      { src: "/brand/weaver-mark-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
