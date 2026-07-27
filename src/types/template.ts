export type TextBox = {
    x: number;
    y: number;
    width: number;
    height: number;
    fontSize: number;
    minFont: number;
    align: "center" | "left" | "right";
    verticalAlign?: "top" | "middle" | "bottom";
    id?: string;
};

export type Template = {
    image: string;
    textBoxes: TextBox[];
    displayName?: string;
    layout?: {
        type: "standard" | "top-banner";
        bannerHeight?: number;
        bannerColor?: string;
    };
};
