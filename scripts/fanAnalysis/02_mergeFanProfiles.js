import fs from "fs";
import path from "path";

export function mergeProfiles() {
  /*Weights for a Like vs a Comment in scoring fans
  Can be tweaked later
  */
  const LIKE_WEIGHT = 1;
  const COMMENT_WEIGHT = 3;

  const INSTA_ENGAGEMENT_DIR = "output/fan-analysis";

  const ANALYSIS_FILES = fs
    .readdirSync(INSTA_ENGAGEMENT_DIR)
    .filter((file) => file.startsWith("ig-engagement-raw-"))
    .filter((file) => file.endsWith(".json"));

  if (ANALYSIS_FILES.length === 0) {
    console.log("No anaylsis files found in /output/fan-analysis.");
    return;
  }

  const latestFile = ANALYSIS_FILES.sort().at(-1);
  console.log(`Merging ${latestFile}`);

  const raw = JSON.parse(
    fs.readFileSync(path.join(INSTA_ENGAGEMENT_DIR, latestFile), "utf8"),
  );

  const fansById = {};

  function getFan(fan) {
    if (!fansById[fan.id]) {
      fansById[fan.id] = {
        id: fan.id,
        username: fan.username,
        is_private: false,
        is_verified: false,
        postsLiked: new Set(),
        postsCommented: new Set(),
      };
    }
    const fanRecord = fansById[fan.id];
    fanRecord.is_private ||= fan.is_private; // private if any post says so
    fanRecord.is_verified ||= fan.is_verified;
    return fanRecord;
  }
  for (const post of raw.posts) {
    for (const fan of post.likers) {
      getFan(fan).postsLiked.add(post.shortCode);
    }
    for (const comment of post.comments) {
      getFan(comment.owner).postsCommented.add(post.shortCode);
    }
  }

  for (const fanObj of Object.values(fansById)) {
    fanObj.postsLiked = [...fanObj.postsLiked];
    fanObj.postsCommented = [...fanObj.postsCommented];
    fanObj.postsEngaged = new Set([
      ...fanObj.postsLiked,
      ...fanObj.postsCommented,
    ]).size;

    fanObj.score =
      fanObj.postsLiked.length * LIKE_WEIGHT +
      fanObj.postsCommented.length * COMMENT_WEIGHT;
  }
  const fans = Object.values(fansById).sort((a, b) => b.score - a.score);

  //Timestamp
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");

  const fansPath = path.join(
    INSTA_ENGAGEMENT_DIR,
    latestFile.replace("ig-engagement-raw-", "ig-fans-"),
  );

  //Write the raw engagement data to a JSON file in the output directory

  fs.writeFileSync(fansPath, JSON.stringify(fans, null, 2));

  console.log(`Saved to ${fansPath}`);

  console.log("");
  console.log("<<<<<<<<<<<<<<< MERGING FANS >>>>>>>>>>>>>>>");
  console.log("");
  console.log("Total Fans: ", fans.length);
  console.log(" private: ", fans.filter((fan) => fan.is_private).length);
  console.log(" verified: ", fans.filter((fan) => fan.is_verified).length);
  console.log(
    " commented: ",
    fans.filter((fan) => fan.postsCommented.length > 0).length,
  );
  console.log(
    " engaged in 2+ posts: ",
    fans.filter((fan) => fan.postsEngaged > 1).length,
  );
  console.log(
    " Public Fans That Engaged in 2+ Posts: ",
    fans.filter((fan) => !fan.is_private && fan.postsEngaged > 1).length,
  );
  console.log(
    " Super fans that engaged in every post: ",
    fans.filter((fan) => fan.postsEngaged === raw.posts.length).length,
  );

  console.log("Saved To ", fansPath);
}

mergeProfiles();
