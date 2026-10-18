import { createFromSource } from "fumadocs-core/search/server";

import { source } from "@/lib/source";

// Cmd+K search over every docs page, built and run locally: no outside service.
export const { GET } = createFromSource(source);
