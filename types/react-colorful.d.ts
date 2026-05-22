/** Shim: package.json `exports` omits `types` for the ESM entry; TS bundler resolution cannot pick up dist/index.d.ts. */
declare module "react-colorful" {
  import type { JSX } from "react";

  export interface HexColorPickerProps {
    color: string;
    onChange: (hex: string) => void;
  }

  export function HexColorPicker(props: HexColorPickerProps): JSX.Element;
}
