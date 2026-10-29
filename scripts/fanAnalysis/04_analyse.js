import fs from "fs";
import path from "path";

export function AnalyseFans() {
  const INSTA_ENGAGEMENT_DIR = "output/fan-analysis";

  const ARTIST_USERNAME = "circawaves";

  const MIN_FANS = 2; // Set for two for low tests but could be set higher for real world

  const ANALYSIS_FILES = fs
    .readdirSync(INSTA_ENGAGEMENT_DIR)
    .filter((file) => file.startsWith("ig-following-"))
    .filter((file) => file.endsWith(".json"));

  if (ANALYSIS_FILES.length === 0) {
    console.log("No following list files found in /output/fan-analysis.");
    return;
  }

  const latestFile = ANALYSIS_FILES.sort().at(-1);

  console.log("-------------------------------");
  console.log(`Analysing fans from ${latestFile}`);
  console.log("-------------------------------");

  const raw = JSON.parse(
    fs.readFileSync(path.join(INSTA_ENGAGEMENT_DIR, latestFile), "utf8"),
  );

  const usableFans = raw.filter((fan) => !fan.error);

  //   const accountCounts = new Map(); // account id → number of fans who follow it

  const followedAccounts = {};

  function countFollow(account) {
    if (!followedAccounts[account.id]) {
      followedAccounts[account.id] = {
        id: account.id,
        username: account.username,
        full_name: account.full_name,
        is_verified: account.is_verified,
        fans: 0,
        share: 0,
      };
    }
    followedAccounts[account.id].fans += 1;
  }

  for (const fan of usableFans) {
    for (const followed of fan.following) {
      if (fan.error) continue;
      if (followed.username === ARTIST_USERNAME) continue;
      countFollow(followed);
    }
  }

  const shared = Object.values(followedAccounts)
    .filter((account) => account.fans >= MIN_FANS)
    .sort((a, b) => b.fans - a.fans);

  //Filter out unusable fans that returned error;

  console.log(
    "Analysing ",
    usableFans.length,
    " of ",
    raw.length,
    " fans ",
    raw.length - usableFans.length,
    " failed",
  );

  //check for how many of the sampled fans follow each account that has more than 1 follower;
  for (const followedAccount of shared) {
    followedAccount.share = followedAccount.fans / usableFans.length;
  }

  console.log("");
  console.log("");
  console.log("-------------------------------");
  console.log("total accounts followed by multiple fans is ", shared.length);
  console.log("-------------------------------");
  console.log("");
  console.log("");

  console.table(
    shared.map(({ username, fans, share }) => ({
      username,
      fans,
      share: `${Math.round(share * 100)}%`,
    })),
  );

  const sharedAccountsPath = path.join(
    INSTA_ENGAGEMENT_DIR,
    latestFile.replace("ig-fans-", "ig-shared-accounts-"),
  );

  fs.writeFileSync(sharedAccountsPath, JSON.stringify(shared, null, 2));

  console.log(`Saved to ${sharedAccountsPath}`);
}

AnalyseFans();
