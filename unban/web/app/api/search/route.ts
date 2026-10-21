import { createFromSource } from "fumadocs-core/search/server";

import { source } from "@/lib/source";

// Cmd+K search over every docs page, indexed at build and run locally: no outside service.
export const revalidate = false;
export const { staticGET: GET } = createFromSource(source, { language: "english" });
