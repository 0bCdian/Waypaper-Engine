export interface Image {
    width: number;
    height: number;
    format: string;
    name: string;
}

export type Formats =
    | "jpg"
    | "jpeg"
    | "png"
    | "bmp"
    | "gif"
    | "webp"
    | "farbfeld"
    | "pnm"
    | "tga"
    | "tiff";
