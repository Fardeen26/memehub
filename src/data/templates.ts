import { cloudinary } from "@/lib/cloudinary";

export interface OptimizedMemeTemplate {
    originalUrl: string;
    urls?: {
        mobile: string;
        tablet: string;
        desktop: string;
        original: string;
        thumbnail: string;
        placeholder: string;
    };
    textBoxes: Array<{
        x: number;
        y: number;
        width: number;
        height: number;
        fontSize: number;
        minFont: number;
        align: "center" | "left" | "right";
        verticalAlign?: "top" | "middle" | "bottom";
    }>;
    width?: number;
    height?: number;
    category?: string;
    tags?: string[];
    image?: string;
}

export const optimizeTemplates = (
    templates: Record<string, OptimizedMemeTemplate>
): Record<string, OptimizedMemeTemplate> => {
    const optimized: Record<string, OptimizedMemeTemplate> = {};

    Object.entries(templates).forEach(([key, template]) => {
        try {
            const urls = cloudinary.generateResponsiveUrls(template.originalUrl);

            optimized[key] = {
                ...template,
                urls: {
                    ...urls,
                    thumbnail: cloudinary.getThumbnail(template.originalUrl),
                    placeholder: cloudinary.getBlurPlaceholder(template.originalUrl)
                },
                image: template.originalUrl
            };
        } catch (error) {
            console.warn(`Failed to optimize template ${key}:`, error);
            optimized[key] = {
                ...template,
                image: template.originalUrl
            };
        }
    });

    return optimized;
};

export const rawTemplates: Record<string, OptimizedMemeTemplate> = {
    "A-Train-Hitting-A-School-Bus": {
        originalUrl: "https://res.cloudinary.com/dl27j0qcm/image/upload/v1755015476/memes/A%20Train%20Hitting%20A%20School%20Bus.png",
        textBoxes: [
            { x: 270, y: 120, width: 300, height: 120, fontSize: 40, minFont: 20, align: "center", verticalAlign: "middle" },
            { x: 20, y: 400, width: 351, height: 200, fontSize: 50, minFont: 20, align: "center", verticalAlign: "top" }
        ]
    },

    "arjun-kapoor": {
        originalUrl: "https://res.cloudinary.com/dl27j0qcm/image/upload/v1754999475/memes/arjun-kapoor.png",
        textBoxes: [
            { x: 20, y: 10, width: 703, height: 200, fontSize: 60, minFont: 20, align: "center", verticalAlign: "top" },
            { x: 20, y: 530, width: 703, height: 160, fontSize: 60, minFont: 20, align: "center", verticalAlign: "top" }
        ]
    },

    "doge beater": {
        originalUrl: "https://res.cloudinary.com/dl27j0qcm/image/upload/v1755015478/memes/doge%20beater.png",
        textBoxes: [
            { x: 30, y: 250, width: 500, height: 250, fontSize: 60, minFont: 20, align: "center", verticalAlign: "top" },
            { x: 570, y: 385, width: 350, height: 200, fontSize: 60, minFont: 20, align: "center", verticalAlign: "top" }
        ]
    },

    "Jim Halpert Explains": {
        originalUrl: "https://res.cloudinary.com/dl27j0qcm/image/upload/v1755015479/memes/Jim%20Halpert%20Explains.png",
        textBoxes: [
            { x: 10, y: 40, width: 390, height: 210, fontSize: 50, minFont: 20, align: "center", verticalAlign: "top" },
            { x: 10, y: 399, width: 345, height: 260, fontSize: 50, minFont: 20, align: "center", verticalAlign: "top" }
        ]
    },

    "Types Of Headaches": {
        originalUrl: "https://res.cloudinary.com/dl27j0qcm/image/upload/v1755015482/memes/Types%20Of%20Headaches.png",
        textBoxes: [
            { x: 490, y: 610, width: 440, height: 100, fontSize: 60, minFont: 20, align: "center", verticalAlign: "bottom" }
        ]
    },

    "world-if": {
        originalUrl: "https://res.cloudinary.com/dl27j0qcm/image/upload/v1755015484/memes/world-if.png",
        textBoxes: [
            { x: 20, y: 10, width: 960, height: 120, fontSize: 60, minFont: 20, align: "center", verticalAlign: "top" },
            { x: 20, y: 432, width: 960, height: 120, fontSize: 60, minFont: 20, align: "center", verticalAlign: "middle" }
        ]
    },

    "how-joker-madeup": {
        originalUrl: "https://res.cloudinary.com/dl27j0qcm/image/upload/v1755013451/memes/Screenshot%202025-07-13%20211445.png",
        textBoxes: [
            { x: 10, y: 5, width: 500, height: 173, fontSize: 60, minFont: 20, align: "center", verticalAlign: "top" },
            { x: 10, y: 570, width: 500, height: 175, fontSize: 60, minFont: 20, align: "center", verticalAlign: "top" },
            { x: 10, y: 195, width: 500, height: 170, fontSize: 60, minFont: 20, align: "center", verticalAlign: "top" },
            { x: 10, y: 380, width: 500, height: 175, fontSize: 60, minFont: 20, align: "center", verticalAlign: "top" }
        ]
    },

    "yes-youre-right": {
        originalUrl: "https://res.cloudinary.com/dl27j0qcm/image/upload/v1755012709/memes/meme.png",
        textBoxes: [
            { x: 110, y: 100, width: 500, height: 400, fontSize: 70, minFont: 20, align: "center", verticalAlign: "top" },
            { x: 750, y: 150, width: 400, height: 200, fontSize: 60, minFont: 20, align: "center", verticalAlign: "top" }
        ]
    },

    "Scared-Lady": {
        originalUrl: "https://res.cloudinary.com/dl27j0qcm/image/upload/v1755020763/meme-templates/Scared-Lady.jpg",
        textBoxes: [
            { x: 100, y: 370, width: 600, height: 400, fontSize: 100, minFont: 40, align: "center" as const },
            { x: 700, y: 750, width: 600, height: 400, fontSize: 100, minFont: 40, align: "center" as const }
        ]
    },

    "Harkirat-brah": {
        originalUrl: "https://res.cloudinary.com/dl27j0qcm/image/upload/v1755020769/meme-templates/Harkirat-brah.png",
        textBoxes: [
            { x: 20, y: 850, width: 400, height: 100, fontSize: 60, minFont: 40, align: "center" as const }
        ]
    },

    "Modi-g-Poster": {
        originalUrl: "https://res.cloudinary.com/dl27j0qcm/image/upload/v1755020770/meme-templates/Modi-g-Poster.jpg",
        textBoxes: [
            { x: 100, y: 170, width: 450, height: 400, fontSize: 70, minFont: 20, align: "center" as const },
            { x: 100, y: 470, width: 450, height: 400, fontSize: 70, minFont: 20, align: "center" as const }
        ]
    },

    "Amrit-dawg": {
        originalUrl: "https://res.cloudinary.com/dl27j0qcm/image/upload/v1755020772/meme-templates/Amrit-dawg.jpg",
        textBoxes: [
            { x: 100, y: 170, width: 1800, height: 400, fontSize: 150, minFont: 20, align: "center" as const },
            { x: 100, y: 970, width: 1800, height: 400, fontSize: 150, minFont: 20, align: "center" as const }
        ]
    },

    "only-aim": {
        originalUrl: "https://res.cloudinary.com/dl27j0qcm/image/upload/v1755022728/temp54_sy9pkc.png",
        textBoxes: [
            { x: 350, y: 950, width: 2400, height: 1000, fontSize: 200, minFont: 40, align: "center" as const },
            { x: 1050, y: 2750, width: 800, height: 1000, fontSize: 250, minFont: 40, align: "center" as const }
        ]
    },

    "no-way-dawg": {
        originalUrl: "https://res.cloudinary.com/dl27j0qcm/image/upload/v1755022692/temp57_kbkrqy.png",
        textBoxes: [
            { x: 150, y: 1350, width: 1400, height: 600, fontSize: 200, minFont: 40, align: "center" as const },
            { x: 2000, y: 1250, width: 1100, height: 800, fontSize: 200, minFont: 40, align: "center" as const }
        ]
    },

    "amrit's-offer": {
        originalUrl: "https://res.cloudinary.com/dl27j0qcm/image/upload/v1755020790/meme-templates/amrit%27s-offer.jpg",
        textBoxes: [
            { x: 0, y: 290, width: 200, height: 200, fontSize: 10, minFont: 40, align: "center" as const },
            { x: 300, y: 290, width: 200, height: 200, fontSize: 10, minFont: 40, align: "center" as const }
        ]
    },
    "Kirat-humble-guy": {
        originalUrl: "https://res.cloudinary.com/dl27j0qcm/image/upload/v1755020791/meme-templates/Kirat-humble-guy.jpg",
        textBoxes: [
            { x: 5, y: 50, width: 470, height: 100, fontSize: 40, minFont: 10, align: "center" as const },
            { x: 5, y: 395, width: 470, height: 90, fontSize: 40, minFont: 10, align: "center" as const }
        ]
    },
    "Bumrah-Bhai": {
        originalUrl: "https://res.cloudinary.com/dl27j0qcm/image/upload/v1755020792/meme-templates/Bumrah-Bhai.jpg",
        textBoxes: [
            { x: 100, y: 470, width: 450, height: 400, fontSize: 70, minFont: 20, align: "center" as const },
            { x: 530, y: 570, width: 400, height: 400, fontSize: 70, minFont: 20, align: "center" as const }
        ]
    },
    "Pani-pilo": {
        originalUrl: "https://res.cloudinary.com/dl27j0qcm/image/upload/v1755020794/meme-templates/Pani-pilo.jpg",
        textBoxes: [
            { x: 10, y: 60, width: 600, height: 100, fontSize: 60, minFont: 20, align: "center" as const },
            { x: 10, y: 450, width: 600, height: 100, fontSize: 60, minFont: 20, align: "center" as const }
        ]
    },
    "the-great-khali": {
        originalUrl: "https://res.cloudinary.com/dl27j0qcm/image/upload/v1755020795/meme-templates/the-great-khali.jpg",
        textBoxes: [
            { x: 1, y: 60, width: 640, height: 300, fontSize: 50, minFont: 20, align: "center" as const },
            { x: 10, y: 540, width: 630, height: 140, fontSize: 50, minFont: 20, align: "center" as const }
        ]
    },
    "wait-a-minute": {
        originalUrl: "https://res.cloudinary.com/dl27j0qcm/image/upload/v1755020803/meme-templates/wait-a-minute.jpg",
        textBoxes: [
            { x: 1, y: 450, width: 1200, height: 600, fontSize: 200, minFont: 40, align: "center" as const },
            { x: 50, y: 1450, width: 1200, height: 600, fontSize: 200, minFont: 40, align: "center" as const }
        ]
    },
    "two-spiders": {
        originalUrl: "https://res.cloudinary.com/dl27j0qcm/image/upload/v1755020805/meme-templates/two-spiders.jpg",
        textBoxes: [
            { x: 100, y: 600, width: 800, height: 600, fontSize: 150, minFont: 40, align: "center" as const },
            { x: 1100, y: 600, width: 800, height: 600, fontSize: 150, minFont: 40, align: "center" as const }
        ]
    },
    "two-paths": {
        originalUrl: "https://res.cloudinary.com/dl27j0qcm/image/upload/v1755020808/meme-templates/two-paths.png",
        textBoxes: [
            { x: 10, y: 200, width: 1000, height: 400, fontSize: 150, minFont: 40, align: "center" as const },
            { x: 1000, y: 200, width: 1000, height: 400, fontSize: 150, minFont: 40, align: "center" as const }
        ]
    },
    "secret-revealed": {
        originalUrl: "https://res.cloudinary.com/dl27j0qcm/image/upload/v1755020811/meme-templates/secret-revealed.png",
        textBoxes: [
            { x: 100, y: 450, width: 2000, height: 1200, fontSize: 300, minFont: 40, align: "center" as const },
            { x: 100, y: 3325, width: 2000, height: 1200, fontSize: 300, minFont: 40, align: "center" as const }
        ]
    },
    "miss-you": {
        originalUrl: "https://res.cloudinary.com/dl27j0qcm/image/upload/v1755020813/meme-templates/miss-you.png",
        textBoxes: [
            { x: 240, y: 630, width: 300, height: 200, fontSize: 80, minFont: 40, align: "center" as const }
        ]
    },
    "medison-ji": {
        originalUrl: "https://res.cloudinary.com/dl27j0qcm/image/upload/v1755020815/meme-templates/medison-ji.jpg",
        textBoxes: [
            { x: 200, y: 130, width: 350, height: 200, fontSize: 100, minFont: 40, align: "center" as const },
            { x: 570, y: 250, width: 350, height: 200, fontSize: 80, minFont: 40, align: "center" as const },
            { x: 950, y: 150, width: 350, height: 200, fontSize: 100, minFont: 40, align: "center" as const }
        ]
    },
    "pakda-gaya": {
        originalUrl: "https://res.cloudinary.com/dl27j0qcm/image/upload/v1755020816/meme-templates/pakda-gaya.jpg",
        textBoxes: [
            { x: 250, y: 350, width: 900, height: 400, fontSize: 100, minFont: 40, align: "center" as const }
        ]
    },
    "chess-tension": {
        originalUrl: "https://res.cloudinary.com/dl27j0qcm/image/upload/v1755020817/meme-templates/chess-tension.jpg",
        textBoxes: [
            { x: 20, y: 60, width: 640, height: 200, fontSize: 50, minFont: 20, align: "center" as const },
            { x: 20, y: 450, width: 630, height: 200, fontSize: 50, minFont: 20, align: "center" as const }
        ]
    },
    "listen-to-me": {
        originalUrl: "https://res.cloudinary.com/dl27j0qcm/image/upload/v1755020819/meme-templates/listen-to-me.jpg",
        textBoxes: [
            { x: 1, y: 260, width: 500, height: 300, fontSize: 80, minFont: 20, align: "center" as const },
            { x: 450, y: 560, width: 400, height: 300, fontSize: 80, minFont: 20, align: "center" as const }
        ]
    },
    "wanna-be": {
        originalUrl: "https://res.cloudinary.com/dl27j0qcm/image/upload/v1755020820/meme-templates/wanna-be.jpg",
        textBoxes: [
            { x: 1, y: 260, width: 300, height: 200, fontSize: 40, minFont: 20, align: "center" as const },
            { x: 400, y: 260, width: 300, height: 200, fontSize: 40, minFont: 20, align: "center" as const }
        ]
    },
    "you-vs-him": {
        originalUrl: "https://res.cloudinary.com/dl27j0qcm/image/upload/v1755020821/meme-templates/you-vs-him.jpg",
        textBoxes: [
            { x: 80, y: 450, width: 1000, height: 500, fontSize: 140, minFont: 10, align: "center" as const },
            { x: 40, y: 1500, width: 500, height: 400, fontSize: 140, minFont: 10, align: "center" as const },
            { x: 480, y: 1500, width: 500, height: 400, fontSize: 140, minFont: 10, align: "center" as const }
        ]
    },
    "developer-stage": {
        originalUrl: "https://res.cloudinary.com/dl27j0qcm/image/upload/v1755020823/meme-templates/developer-stage.jpg",
        textBoxes: [
            { x: 900, y: 150, width: 600, height: 400, fontSize: 100, minFont: 40, align: "center" as const },
            { x: 900, y: 610, width: 600, height: 400, fontSize: 100, minFont: 40, align: "center" as const },
            { x: 900, y: 1050, width: 600, height: 400, fontSize: 100, minFont: 40, align: "center" as const },
            { x: 900, y: 1500, width: 600, height: 400, fontSize: 100, minFont: 40, align: "center" as const }
        ]
    },
    "Bhola-Bachcha": {
        originalUrl: "https://res.cloudinary.com/dl27j0qcm/image/upload/v1755020824/meme-templates/Bhola-Bachcha.jpg",
        textBoxes: [
            { x: 50, y: 240, width: 2000, height: 500, fontSize: 180, minFont: 40, align: "center" as const },
            { x: 50, y: 1880, width: 2000, height: 300, fontSize: 180, minFont: 40, align: "center" as const }
        ]
    },
    "hungery-monkey": {
        originalUrl: "https://res.cloudinary.com/dl27j0qcm/image/upload/v1755020825/meme-templates/hungery-monkey.jpg",
        textBoxes: [
            { x: 240, y: 450, width: 450, height: 100, fontSize: 60, minFont: 40, align: "center" as const },
            { x: 20, y: 850, width: 400, height: 100, fontSize: 60, minFont: 40, align: "center" as const }
        ]
    },
    "sympathy-girl": {
        originalUrl: "https://res.cloudinary.com/dl27j0qcm/image/upload/v1755020826/meme-templates/sympathy-girl.jpg",
        textBoxes: [
            { x: 50, y: 1000, width: 1150, height: 200, fontSize: 100, minFont: 50, align: "center" as const }
        ]
    },
    "Doge Vs. Cheems": {
        originalUrl: "https://res.cloudinary.com/dl27j0qcm/image/upload/v1755020828/meme-templates/Doge%20Vs.%20Cheems.png",
        textBoxes: [
            { x: 50, y: 400, width: 400, height: 200, fontSize: 60, minFont: 14, align: "center" as const },
            { x: 600, y: 400, width: 400, height: 200, fontSize: 60, minFont: 14, align: "center" as const }
        ]
    },
    "I Bet He's Thinking About Other Women": {
        originalUrl: "https://res.cloudinary.com/dl27j0qcm/image/upload/v1755020829/meme-templates/I%20Bet%20He%27s%20Thinking%20About%20Other%20Women.png",
        textBoxes: [
            { x: 100, y: 470, width: 600, height: 400, fontSize: 100, minFont: 40, align: "center" as const },
            { x: 800, y: 650, width: 600, height: 400, fontSize: 100, minFont: 40, align: "center" as const }
        ]
    },
    "aaja-bhidle": {
        originalUrl: "https://res.cloudinary.com/dl27j0qcm/image/upload/v1755020830/meme-templates/aaja-bhidle.jpg",
        textBoxes: [
            { x: 0, y: 550, width: 480, height: 100, fontSize: 40, minFont: 10, align: "center" as const }
        ]
    },
    "flexing-on-baddies": {
        originalUrl: "https://res.cloudinary.com/dl27j0qcm/image/upload/v1755020832/meme-templates/flexing-on-baddies.png",
        textBoxes: [
            { x: 20, y: 60, width: 650, height: 100, fontSize: 60, minFont: 20, align: "center" as const },
            { x: 20, y: 450, width: 650, height: 100, fontSize: 60, minFont: 20, align: "center" as const }
        ]
    },
    "distracted-boyfriend": {
        originalUrl: "https://res.cloudinary.com/dl27j0qcm/image/upload/v1755020833/meme-templates/distracted-boyfriend.jpg",
        textBoxes: [
            { x: 80, y: 550, width: 520, height: 150, fontSize: 80, minFont: 40, align: "center" as const },
            { x: 560, y: 400, width: 400, height: 100, fontSize: 70, minFont: 40, align: "center" as const },
            { x: 800, y: 500, width: 400, height: 200, fontSize: 70, minFont: 40, align: "center" as const }
        ]
    },
    "Ch*d gaye guru": {
        originalUrl: "https://res.cloudinary.com/dl27j0qcm/image/upload/v1755020835/meme-templates/Ch%2Ad%20gaye%20guru.png",
        textBoxes: [
            { x: 100, y: 470, width: 300, height: 100, fontSize: 40, minFont: 20, align: "center" as const }
        ]
    },
    "Buzz-And-Woody": {
        originalUrl: "https://res.cloudinary.com/dl27j0qcm/image/upload/v1755020836/meme-templates/Buzz-And-Woody.png",
        textBoxes: [
            { x: 25, y: 60, width: 700, height: 100, fontSize: 56, minFont: 10, align: "center" as const },
            { x: 25, y: 445, width: 700, height: 100, fontSize: 56, minFont: 10, align: "center" as const }
        ]
    },
    "Grim-Reaper-Doors": {
        originalUrl: "https://res.cloudinary.com/dl27j0qcm/image/upload/v1755020837/meme-templates/Grim-Reaper-Doors.png",
        textBoxes: [
            { x: 58, y: 1050, width: 508, height: 300, fontSize: 100, minFont: 40, align: "center" as const },
            { x: 708, y: 1300, width: 630, height: 400, fontSize: 150, minFont: 40, align: "center" as const },
            { x: 1758, y: 1244, width: 658, height: 300, fontSize: 200, minFont: 40, align: "center" as const },
            { x: 3290, y: 1320, width: 958, height: 400, fontSize: 250, minFont: 40, align: "center" as const },
            { x: 2600, y: 1880, width: 710, height: 400, fontSize: 300, minFont: 40, align: "center" as const }
        ]
    },

    "Disaster-Girl": {
        originalUrl: "https://res.cloudinary.com/dl27j0qcm/image/upload/v1755020839/meme-templates/Disaster-Girl.png",
        textBoxes: [
            { x: 10, y: 140, width: 180, height: 200, fontSize: 40, minFont: 14, align: "center" as const },
            { x: 200, y: 350, width: 180, height: 200, fontSize: 40, minFont: 14, align: "center" as const }
        ]
    },

    "IQ-Curve": {
        originalUrl: "https://res.cloudinary.com/dl27j0qcm/image/upload/v1755020841/meme-templates/IQ-Curve.jpg",
        textBoxes: [
            { x: 50, y: 850, width: 850, height: 480, fontSize: 180, minFont: 40, align: "center" as const },
            { x: 700, y: 200, width: 1300, height: 270, fontSize: 150, minFont: 0, align: "center" as const },
            { x: 1900, y: 700, width: 850, height: 480, fontSize: 180, minFont: 40, align: "center" as const }
        ]
    },

    "black-&-white-woolfs": {
        originalUrl: "https://res.cloudinary.com/dl27j0qcm/image/upload/v1755022305/temp43_u6vh2x.jpg",
        textBoxes: [
            { x: 100, y: 1850, width: 2600, height: 1600, fontSize: 400, minFont: 40, align: "center" as const },
            { x: 3000, y: 1850, width: 2600, height: 1600, fontSize: 400, minFont: 40, align: "center" as const }
        ]
    },

    "haha-im-death": {
        originalUrl: "https://res.cloudinary.com/dl27j0qcm/image/upload/v1755020843/meme-templates/haha-im-death.jpg",
        textBoxes: [
            { x: 750, y: 850, width: 900, height: 600, fontSize: 160, minFont: 40, align: "center" as const }
        ]
    },
    "he-dont-know-yet": {
        originalUrl: "https://res.cloudinary.com/dl27j0qcm/image/upload/v1755020844/meme-templates/he-dont-know-yet.jpg",
        textBoxes: [
            { x: 50, y: 500, width: 600, height: 600, fontSize: 100, minFont: 40, align: "center" as const },
            { x: 710, y: 600, width: 600, height: 600, fontSize: 100, minFont: 40, align: "center" as const }
        ]
    },
    "they-dont-know": {
        originalUrl: "https://res.cloudinary.com/dl27j0qcm/image/upload/v1755020846/meme-templates/they-dont-know.jpg",
        textBoxes: [
            { x: 460, y: 300, width: 600, height: 400, fontSize: 70, minFont: 40, align: "center" as const }
        ]
    },
    "three-dragons": {
        originalUrl: "https://res.cloudinary.com/dl27j0qcm/image/upload/v1755020847/meme-templates/three-dragons.jpg",
        textBoxes: [
            { x: 100, y: 300, width: 600, height: 600, fontSize: 150, minFont: 40, align: "center" as const },
            { x: 800, y: 400, width: 600, height: 600, fontSize: 150, minFont: 40, align: "center" as const },
            { x: 1500, y: 500, width: 600, height: 600, fontSize: 150, minFont: 40, align: "center" as const }
        ]
    },
    "understand-it": {
        originalUrl: "https://res.cloudinary.com/dl27j0qcm/image/upload/v1755020848/meme-templates/understand-it.jpg",
        textBoxes: [
            { x: 150, y: 200, width: 2700, height: 1500, fontSize: 200, minFont: 40, align: "center" as const },
            { x: 150, y: 2000, width: 2700, height: 400, fontSize: 200, minFont: 40, align: "center" as const }
        ]
    },
    "natures-beauty": {
        originalUrl: "https://res.cloudinary.com/dl27j0qcm/image/upload/v1755020850/meme-templates/natures-beauty.png",
        textBoxes: [
            { x: 1000, y: 1700, width: 800, height: 600, fontSize: 150, minFont: 40, align: "center" as const }
        ]
    },

    "sun-be": {
        originalUrl: "https://res.cloudinary.com/dl27j0qcm/image/upload/v1755022618/temp56_jfmi4l.png",
        textBoxes: [
            { x: 200, y: 250, width: 3000, height: 600, fontSize: 250, minFont: 40, align: "center" as const },
            { x: 200, y: 2325, width: 3000, height: 600, fontSize: 250, minFont: 40, align: "center" as const }
        ]
    },

    "i-fear-no-man": {
        originalUrl: "https://res.cloudinary.com/dl27j0qcm/image/upload/v1755020856/meme-templates/i-fear-no-man.png",
        textBoxes: [
            { x: 40, y: 1400, width: 1000, height: 600, fontSize: 200, minFont: 40, align: "center" as const }
        ]
    },
    "two-bros-handshake": {
        originalUrl: "https://res.cloudinary.com/dl27j0qcm/image/upload/v1755020858/meme-templates/two-bros-handshake.png",
        textBoxes: [
            { x: 10, y: 800, width: 1500, height: 600, fontSize: 250, minFont: 40, align: "center" as const },
            { x: 1700, y: 800, width: 1500, height: 600, fontSize: 250, minFont: 40, align: "center" as const },
            { x: 640, y: 2100, width: 2000, height: 800, fontSize: 250, minFont: 40, align: "center" as const }
        ]
    },
    "sleeping-on-cash": {
        originalUrl: "https://res.cloudinary.com/dl27j0qcm/image/upload/v1755020860/meme-templates/sleeping-on-cash.jpg",
        textBoxes: [
            { x: 50, y: 200, width: 1800, height: 400, fontSize: 150, minFont: 40, align: "center" as const },
            { x: 0, y: 1025, width: 1900, height: 400, fontSize: 100, minFont: 40, align: "center" as const }
        ]
    },
    "Eh-i-step-on-shit": {
        originalUrl: "https://res.cloudinary.com/dl27j0qcm/image/upload/v1755020861/meme-templates/Eh-i-step-on-shit.png",
        textBoxes: [
            { x: 800, y: 2370, width: 600, height: 500, fontSize: 200, minFont: 40, align: "center" as const }
        ]
    },
    "space-shooting": {
        originalUrl: "https://res.cloudinary.com/dl27j0qcm/image/upload/v1755020862/meme-templates/space-shooting.jpg",
        textBoxes: [
            { x: 200, y: 370, width: 600, height: 500, fontSize: 140, minFont: 40, align: "center" as const },
            { x: 700, y: 790, width: 600, height: 500, fontSize: 140, minFont: 40, align: "center" as const },
            { x: 1300, y: 750, width: 600, height: 500, fontSize: 140, minFont: 40, align: "center" as const }
        ]
    },
    "Rocky-superstar": {
        originalUrl: "https://res.cloudinary.com/dl27j0qcm/image/upload/v1755020863/meme-templates/Rocky-superstar.png",
        textBoxes: [
            { x: 0, y: 50, width: 365, height: 100, fontSize: 30, minFont: 10, align: "center" as const },
            { x: 0, y: 330, width: 365, height: 90, fontSize: 30, minFont: 10, align: "center" as const }
        ]
    },
    "Trade-offer": {
        originalUrl: "https://res.cloudinary.com/dl27j0qcm/image/upload/v1755020865/meme-templates/Trade-offer.jpg",
        textBoxes: [
            { x: 20, y: 220, width: 250, height: 200, fontSize: 30, minFont: 10, align: "center" as const },
            { x: 330, y: 220, width: 250, height: 200, fontSize: 30, minFont: 10, align: "center" as const }
        ]
    },
    "Water-UNO-Reverse": {
        originalUrl: "https://res.cloudinary.com/dl27j0qcm/image/upload/v1755020869/meme-templates/Water-UNO-Reverse.png",
        textBoxes: [
            { x: 100, y: 200, width: 2000, height: 400, fontSize: 200, minFont: 40, align: "center" as const },
            { x: 100, y: 2200, width: 2000, height: 300, fontSize: 200, minFont: 40, align: "center" as const }
        ]
    },
    "Puzzle-Head": {
        originalUrl: "https://res.cloudinary.com/dl27j0qcm/image/upload/v1755020871/meme-templates/Puzzle-Head.png",
        textBoxes: [
            { x: 150, y: 400, width: 1100, height: 100, fontSize: 200, minFont: 60, align: "center" as const },
            { x: 910, y: 1000, width: 600, height: 100, fontSize: 200, minFont: 30, align: "center" as const }
        ]
    },
    "Trojan-Horse": {
        originalUrl: "https://res.cloudinary.com/dl27j0qcm/image/upload/v1755020874/meme-templates/Trojan-Horse.png",
        textBoxes: [
            { x: 2450, y: 2600, width: 900, height: 200, fontSize: 150, minFont: 40, align: "center" as const },
            { x: 2000, y: 2400, width: 900, height: 200, fontSize: 150, minFont: 40, align: "center" as const },
            { x: 590, y: 1900, width: 1000, height: 200, fontSize: 200, minFont: 40, align: "center" as const },
            { x: 1200, y: 1000, width: 800, height: 200, fontSize: 200, minFont: 40, align: "center" as const },
            { x: 2100, y: 400, width: 800, height: 200, fontSize: 300, minFont: 40, align: "center" as const }
        ]
    },
    "Ladies-Gang": {
        originalUrl: "https://res.cloudinary.com/dl27j0qcm/image/upload/v1755020877/meme-templates/Ladies-Gang.png",
        textBoxes: [
            { x: 0, y: 210, width: 200, height: 100, fontSize: 30, minFont: 8, align: "center" as const },
            { x: 90, y: 360, width: 200, height: 50, fontSize: 30, minFont: 8, align: "center" as const },
            { x: 330, y: 260, width: 200, height: 100, fontSize: 30, minFont: 8, align: "center" as const },
            { x: 510, y: 200, width: 200, height: 100, fontSize: 30, minFont: 8, align: "center" as const }
        ]
    },
    "empty-image": {
        originalUrl: "https://res.cloudinary.com/dl27j0qcm/image/upload/v1755020878/meme-templates/empty-image.jpg",
        textBoxes: [
            { x: 150, y: 270, width: 300, height: 200, fontSize: 60, minFont: 40, align: "center" as const }
        ]
    },
    "Cat-speaker": {
        originalUrl: "https://res.cloudinary.com/dl27j0qcm/image/upload/v1755020879/meme-templates/Cat-speaker.jpg",
        textBoxes: [
            { x: 10, y: 30, width: 210, height: 100, fontSize: 20, minFont: 0, align: "center" as const },
            { x: 10, y: 200, width: 210, height: 100, fontSize: 20, minFont: 0, align: "center" as const }
        ]
    },
    "Megamind": {
        originalUrl: "https://res.cloudinary.com/dl27j0qcm/image/upload/v1755020880/meme-templates/Megamind.png",
        textBoxes: [
            { x: 30, y: 50, width: 500, height: 100, fontSize: 40, minFont: 10, align: "center" as const },
            { x: 30, y: 500, width: 500, height: 90, fontSize: 40, minFont: 10, align: "center" as const }
        ]
    },
    "Red-pill-Blue-pill": {
        originalUrl: "https://res.cloudinary.com/dl27j0qcm/image/upload/v1755020881/meme-templates/Red-pill-Blue-pill.jpg",
        textBoxes: [
            { x: 20, y: 365, width: 250, height: 200, fontSize: 30, minFont: 10, align: "center" as const },
            { x: 280, y: 365, width: 250, height: 200, fontSize: 30, minFont: 10, align: "center" as const }
        ]
    },
    "Bad-Horse": {
        originalUrl: "https://res.cloudinary.com/dl27j0qcm/image/upload/v1755020882/meme-templates/Bad-Horse.png",
        textBoxes: [
            { x: 10, y: 140, width: 180, height: 200, fontSize: 40, minFont: 14, align: "center" as const },
            { x: 510, y: 140, width: 180, height: 200, fontSize: 40, minFont: 14, align: "center" as const }
        ]
    },
    "Butterfly-Man": {
        originalUrl: "https://res.cloudinary.com/dl27j0qcm/image/upload/v1755020883/meme-templates/Butterfly-Man.png",
        textBoxes: [
            { x: 430, y: 200, width: 280, height: 150, fontSize: 52, minFont: 20, align: "center" as const },
            { x: 0, y: 545, width: 400, height: 150, fontSize: 52, minFont: 14, align: "center" as const },
            { x: 5, y: 700, width: 700, height: 60, fontSize: 100, minFont: 10, align: "center" as const }
        ]
    },
    "Kirat-Hunter-Eyes": {
        originalUrl: "https://res.cloudinary.com/dl27j0qcm/image/upload/v1755020885/meme-templates/Kirat-Hunter-Eyes.png",
        textBoxes: [
            { x: 2, y: 147, width: 130, height: 200, fontSize: 12, minFont: 10, align: "center" as const }
        ]
    }
}

export const templates = optimizeTemplates(rawTemplates);