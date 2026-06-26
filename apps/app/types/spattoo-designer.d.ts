// @spattoo/designer is a JS component library (no shipped types yet). Declare the
// exports we use as permissive React components so the app type-checks; tighten to
// real types if/when the library emits .d.ts.
declare module "@spattoo/designer" {
  import type { ComponentType } from "react";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const CakeDesigner: ComponentType<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const CustomerStorefront: ComponentType<any>;
}
