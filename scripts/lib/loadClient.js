// Shared by the scripts in scripts/: works out which client a run is for.
//defaults to circawaves if no --client is specified on the command line.
//to keep cron jobs working. Will be removed at a later date.

import { parseArgs } from "node:util";

export default async function loadClient(supabase) {
  //  Read --client from the command line (default + strict: false)

  const { values: args } = parseArgs({
    options: {
      client: {
        type: "string",
        default: "circawaves",
        short: "c",
      },
    },
    strict: false,
  });

  if (typeof args.client !== "string") {
    throw new Error("--client needs a slug, e.g. --client <band slug>");
  }

  //  Look the slug up in the clients table
  const { data: client, error } = await supabase
    .from("clients")
    .select("*")
    .eq("slug", args.client)
    .maybeSingle();

  // Throw a clear error if there's no match or an error occurred

  if (error) {
    throw new Error(`Error loading client "${args.client}": ${error.message}`);
  }

  if (!client) {
    throw new Error(`No client found with slug "${args.client}"`);
  }

  // Return the client row

  return client;
}
