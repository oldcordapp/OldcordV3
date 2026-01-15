export function convertBuildIds(buildIds) {
  const newBuildIds = buildIds.map((buildId) => convertBuildId(buildId));

  return newBuildIds;
}

export function convertBuildId(buildId) {
  const date = buildId.split("_");
  date[0] = date[0].replace(
    /\w\S*/g,
    (text) => text.charAt(0).toUpperCase() + text.substring(1).toLowerCase()
  );
  const newBuildId = `${date[0]} ${date[1]}, ${date[2]}`;
  return newBuildId;
}
