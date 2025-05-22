type TextBox = {
    x: number;
    y: number;
    width: number;
    height: number;
    fontSize: number;
    align: "center" | "left" | "right";
    id?: string;
};

export type Template = {
    image: string;
    textBoxes: TextBox[];
};