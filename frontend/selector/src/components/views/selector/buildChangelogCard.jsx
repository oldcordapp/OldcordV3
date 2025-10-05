  import { useEffect, useState } from "react";
  import Card from "@oldcord/frontend-shared/components/card";
  import { Text } from "@oldcord/frontend-shared/components/textComponent";
  import Changelog from "../../shared/changelog";
  import { CHANGELOGS, videos } from "../../../constants/buildChangelogs";
  import { convertBuildId } from "../../../lib/convertBuildIds";
  import "./buildChangelogCard.css";

  function markdownToHtml(text) {
    let html = text;
    // Handle special image placeholders first
    html = html.replace(
      /!\[(.*?)\]\(CHANGE_LOG_HEADER\)/g,
      '<img alt="$1" src="https://cdn.discordapp.com/assets/changelog/CHANGE_LOG_HEADER.png" />'
    );

    // Standard markdown conversions
    html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    html = html.replace(
      /\[cta:(.*?)\]\((.*?)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer" class="cta">$1</a>'
    );
    html = html.replace(
      /\[(.*?)\]\((.*?)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
    );
    html = html.replace(/!\[(.*?)\]\((.*?)\)/g, '<img alt="$1" src="$2" />');
    return html;
  }

  function parseChangelog(changelogText) {
    if (!changelogText) return null;

    let body = changelogText;

    const firstChangelogStart = body.indexOf("---changelog---");
    if (firstChangelogStart !== -1) {
      body = body.substring(firstChangelogStart); // Ensure body starts with the block

      // Truncate to only the first changelog entry if multiple exist
      const secondChangelogStart = body.indexOf("---changelog---", 15);
      if (secondChangelogStart !== -1) {
        body = body.substring(0, secondChangelogStart);
      }

      // Remove the frontmatter block without parsing it
      const metaEnd = body.indexOf("\n---", 15);
      if (metaEnd !== -1) {
        body = body.substring(metaEnd + 5).trim();
      } else {
        // Unclosed block, safest to just clear it.
        body = "";
      }
    }


    const parsed = { sections: [], video: null, date: null, cta: null };

    const ctaMatch = body.match(/\[cta:(.*?)\]\((.*?)\)/);
    if (ctaMatch) {
      parsed.cta = { text: ctaMatch[1], url: ctaMatch[2] };
      body = body.replace(ctaMatch[0], "");
    }

    const lines = body.split("\n");
    let currentSection = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;

      const nextLine = lines[i + 1];
      const isHeader = nextLine && nextLine.match(/^={5,}/);

      if (isHeader) {
        if (currentSection) parsed.sections.push(currentSection);

        const headerMatch = line.match(/^(.*?) {(.+?)}$/);
        let title, type;
        if (headerMatch) {
          title = headerMatch[1].trim();
          type = headerMatch[2].split(" ")[0].replace("changelog-", "");
        } else {
          title = line.trim();
          type = "default";
        }

        currentSection = { title, type, items: [] };
        i++; // Skip '====' line
        continue;
      }

      if (!currentSection) {
        currentSection = { title: "", type: "default", items: [] };
      }

      let itemText = line.trim();
      if (itemText.startsWith("*")) {
        itemText = itemText.substring(1).trim();
      }

      if (itemText) {
          currentSection.items.push(markdownToHtml(itemText));
      }
    }

    if (currentSection) parsed.sections.push(currentSection);

    parsed.sections = parsed.sections.filter(s => s.items.length > 0);

    return parsed;
  }


  function getChangelogKeyForBuild(buildId) {
    const friendlyDate = convertBuildId(buildId);
    if (!friendlyDate) return null;
    const [month, day, year] = friendlyDate.replace(",", "").split(" ");
    return `${month.toLowerCase()}_${day}_${year}`;
  }

  export default function BuildChangelogCard({ selectedBuild }) {
    const [changelogData, setChangelogData] = useState(null);

    useEffect(() => {
      if (!selectedBuild) {
        setChangelogData(null);
        return;
      }

      const key = getChangelogKeyForBuild(selectedBuild);
      const changelogText = CHANGELOGS[key];

      if (!changelogText) {
        setChangelogData(null);
        return;
      }

      const parsed = parseChangelog(changelogText);

      if (parsed && !parsed.video && videos[key]) {
        const videoId = videos[key];
        parsed.video = {
          url: `https://youtu.be/${videoId}`,
          thumbnail: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
        };
      }

      if (parsed && !parsed.date) {
        parsed.date = convertBuildId(selectedBuild);
      }

      setChangelogData(parsed);
    }, [selectedBuild]);

    if (!changelogData) {
      return (
        <Card className="build-changlog-card">
          <div className="empty-changelog">
            <Text>No changelog available for this build.</Text>
          </div>
        </Card>
      );
    }

    return (
      <Card className="build-changlog-card">
        <div className="changelog-header">
          <div>
            <Text variant="h4">What's New</Text>
            {changelogData.date && (
              <Text variant="small" className="date">
                {changelogData.date}
              </Text>
            )}
          </div>
        </div>
        <div className="scroller-wrap">
          <div className="scroller">
            {changelogData.cta && (
              <a
                href={changelogData.cta.url}
                target="_blank"
                rel="noopener noreferrer"
                className="cta-button"
              >
                {changelogData.cta.text}
              </a>
            )}
            <Changelog
              sections={changelogData.sections}
              video={changelogData.video}
            />
          </div>
        </div>
      </Card>
    );
  }