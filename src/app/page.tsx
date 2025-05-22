import ShakeyImage from "@/components/ShakeyImage";
import TemplateSearch from "@/components/TemplateSearch";

export default function Home() {
  return (
    <main>
      <section className="flex justify-center pt-12 pb-8 relative">
        <ShakeyImage />
        <div className="flex gap-4 flex-col">
          <h1 className="text-5xl md:text-[5rem] max-w-2xl tracking-tighter text-center font-regular">
            <span className="text-spektr-cyan-50">Generate memes in <span className="text-[#6a7bd1] font-bold">seconds</span></span>
          </h1>
          <p className="text-lg md:text-xl leading-relaxed tracking-tight text-muted-foreground max-w-2xl text-center">
            without dealing with a messy ui
          </p>
        </div>
      </section>
      <TemplateSearch />
    </main>
  );
}
