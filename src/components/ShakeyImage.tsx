import Image from "next/image";

export default function ShakeyImage() {
    return (
        <>
            <Image
                src='/home1.png'
                alt='pepe'
                height={15}
                width={15}
                style={{
                    position: "absolute",
                    right: "28.5rem",
                    top: 51,
                    animation: "shake 0.4s infinite cubic-bezier(.36,.07,.19,.97)",
                    willChange: "transform"
                }}
            />
            <style>
                {`
            @keyframes shake {
              0% { transform: translate(0, 0) rotate(0deg); }
              10% { transform: translate(-2px, 2px) rotate(-2deg); }
              20% { transform: translate(-4px, -2px) rotate(2deg); }
              30% { transform: translate(4px, 2px) rotate(1deg); }
              40% { transform: translate(2px, -2px) rotate(-1deg); }
              50% { transform: translate(-2px, 2px) rotate(2deg); }
              60% { transform: translate(4px, 2px) rotate(-2deg); }
              70% { transform: translate(-4px, -2px) rotate(1deg); }
              80% { transform: translate(2px, 2px) rotate(-1deg); }
              90% { transform: translate(-2px, -2px) rotate(2deg); }
              100% { transform: translate(0, 0) rotate(0deg); }
            }
          `}
            </style>
        </>
    )
}