// scripts/fanAnalysis/06_summarise.js
//
// Stage 6 of the fan analysis: turns categorised accounts into fan-level shares —
// what percentage of engaged fans follow at least one account in each category,
// subcategory and team. The output holds totals only, no fan data.
//
// Run with:
//   node scripts/fanAnalysis/06_summarise.js

import fs from "node:fs";
import path from "node:path";

const FAN_ANALYSIS_DIR = "output/fan-analysis";

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(FAN_ANALYSIS_DIR, file), "utf8"));
}

function loadInputs() {
  const categorisedFile = fs
    .readdirSync(FAN_ANALYSIS_DIR)
    .filter(
      (file) =>
        file.startsWith("ig-accounts-categorised-") && file.endsWith(".json"),
    )
    .sort()
    .at(-1);

  if (!categorisedFile) {
    throw new Error("No ig-accounts-categorised-*.json files — run 05 first.");
  }

  // The follow lists must come from the same 03 run the categories were built
  // from, so use the matching timestamp rather than the newest file
  const followingFile = categorisedFile.replace(
    "ig-accounts-categorised-",
    "ig-following-",
  );
  if (!fs.existsSync(path.join(FAN_ANALYSIS_DIR, followingFile))) {
    throw new Error(
      `Missing ${followingFile}, which ${categorisedFile} was built from.`,
    );
  }

  console.log(`Summarising ${categorisedFile} with ${followingFile}`);
  return {
    stamp: categorisedFile.replace("ig-accounts-categorised-", ""),
    accounts: readJson(categorisedFile),
    fans: readJson(followingFile).filter((fan) => !fan.error),
  };
}

function buildClassificationLookup(accounts) {
  const lookup = new Map();
  for (const account of accounts) {
    lookup.set(account.id, account.classification);
  }
  return lookup;
}

// For each fan, collect the set of categories/subcategories/teams they follow
// at least one account in, then count how many fans have each one
function countFans(fans, lookup) {
  const counts = {
    category: new Map(),
    subcategory: new Map(),
    team: new Map(),
  };

  for (const fan of fans) {
    const seen = {
      category: new Set(),
      subcategory: new Set(),
      team: new Set(),
    };

    for (const account of fan.following) {
      const classification = lookup.get(account.id);
      if (!classification) continue;

      for (const field of ["category", "subcategory", "team"]) {
        if (classification[field]) seen[field].add(classification[field]);
      }
    }

    for (const field of ["category", "subcategory", "team"]) {
      for (const value of seen[field]) {
        counts[field].set(value, (counts[field].get(value) ?? 0) + 1);
      }
    }
  }

  return counts;
}

function toShares(countMap, totalFans) {
  return [...countMap]
    .map(([name, fans]) => ({ name, fans, share: fans / totalFans }))
    .sort((a, b) => b.fans - a.fans);
}

// Individual accounts, with their classification, most-followed first
function topAccounts(accounts) {
  return accounts
    .map((account) => ({
      username: account.username,
      full_name: account.full_name,
      fans: account.fans,
      share: account.share,
      category: account.classification.category,
      subcategory: account.classification.subcategory,
      team: account.classification.team,
    }))
    .sort((a, b) => b.fans - a.fans);
}

function topAccountsByCategory(accountRows, perCategory = 5) {
  const byCategory = {};
  for (const row of accountRows) {
    byCategory[row.category] ??= [];
    if (byCategory[row.category].length < perCategory)
      byCategory[row.category].push(row);
  }
  return byCategory;
}

function main() {
  const { stamp, accounts, fans } = loadInputs();
  const lookup = buildClassificationLookup(accounts);
  const counts = countFans(fans, lookup);
  const accountRows = topAccounts(accounts);

  const summary = {
    fansAnalysed: fans.length,
    accountsCategorised: accounts.length,
    categories: toShares(counts.category, fans.length),
    subcategories: toShares(counts.subcategory, fans.length),
    teams: toShares(counts.team, fans.length),
    accounts: topAccounts(accounts),
    accountsByCategory: topAccountsByCategory(accountRows),
  };

  const summaryPath = path.join(FAN_ANALYSIS_DIR, `ig-summary-${stamp}`);
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

  // print summary.categories / subcategories / teams with console.table
  function printTable(title, rows) {
    console.log(`\n${title}`);
    console.table(
      rows.map(({ name, fans, share }) => ({
        name,
        fans,
        share: `${Math.round(share * 100)}%`,
      })),
    );
  }

  printTable("Categories", summary.categories);
  printTable("Subcategories", summary.subcategories);
  printTable("Teams", summary.teams);
  console.log(`Saved to ${summaryPath}`);
}

main();
