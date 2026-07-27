type ExternalScriptDescriptor = Readonly<{
  id: string;
  src: string;
  strategy: "afterInteractive";
  async?: boolean;
  crossOrigin?: "anonymous";
}>;

export const ADSENSE_CLIENT_ID = "ca-pub-1916939586711533";
export const ADSENSE_SCRIPT_URL =
  `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`;

export const externalScriptDescriptors: readonly ExternalScriptDescriptor[] = [
  {
    id: "google-adsense",
    src: ADSENSE_SCRIPT_URL,
    strategy: "afterInteractive",
    async: true,
    crossOrigin: "anonymous",
  },
];
