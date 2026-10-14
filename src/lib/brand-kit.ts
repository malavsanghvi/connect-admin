// The Weaver Brand Kit values that TypeScript needs (the CSS gets the whole kit from src/app/brand-tokens.css).
// Read from brand/tokens.json, the vendored copy of the kit's tokens, so a colour is never typed here.

import tokens from "../../brand/tokens.json";

const colors = new Map<string, string>(tokens.color.tokens.map((t) => [t.name, t.value]));

/** A kit colour by token name, e.g. kitColor("navy"). Throws on an unknown name so a typo fails the build. */
export function kitColor(name: string): string {
  const value = colors.get(name);
  if (!value) throw new Error(`The Weaver Brand Kit has no colour token "${name}"`);
  return value;
}

/** The product's name: always "Weaver" (the kit's voice rules). The organization's own name is the tenant's. */
export const PRODUCT_NAME = "Weaver";

/** The line under the wordmark wherever the logo is shown (brand/components/Logo). */
export const PRODUCT_DESCRIPTOR = "Community management platform";
