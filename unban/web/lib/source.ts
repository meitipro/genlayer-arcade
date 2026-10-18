import { loader } from "fumadocs-core/source";

import { docs } from "@/.source";

// fumadocs-mdx 11.10 hands its files over as a function; fumadocs-core 15.8 reads an array.
type MdxSource = ReturnType<typeof docs.toFumadocsSource>;
const mdx = docs.toFumadocsSource();
const files = (mdx as unknown as { files: unknown }).files;
const resolved = { files: typeof files === "function" ? (files as () => unknown)() : files } as unknown as MdxSource;

export const source = loader({ baseUrl: "/docs", source: resolved });
