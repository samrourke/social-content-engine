export const CATEGORY_DIRECTORIES = {
  interview: "interviews",
  "professional live": "professional-live",
  "fan live": "fan-live",
  "backstage / tour": "backstage-tour",
  "studio / acoustic": "studio-acoustic",
  "official / promo": "official-promo",
  other: "other",
};

export const VIDEO_DIRECTORIES = Object.values(CATEGORY_DIRECTORIES).map(
  (directory) => `input/${directory}`,
);
