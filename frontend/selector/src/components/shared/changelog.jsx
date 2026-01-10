import React from 'react';
import './changelog.css';
import { Text } from '@oldcord/frontend-shared/components/textComponent';
import changlogImage from '../../assets/changelogImage.png';

const headerTypeClasses = {
  added: 'header-added',
  fixed: 'header-fixed',
  improved: 'header-improved',
  progress: 'header-progress',
  default: 'header-default',
};

export default function Changelog({ sections, video, image = false, style }) {
  const videoId = video ? new URL(video.url).pathname.split('/').pop() : null;

  return (
    <div className="changelog-container" style={style}>
      {videoId && (
        <div className="changelog-video">
          <iframe
            src={`https://www.youtube.com/embed/${videoId}`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title="Changelog Video"
          ></iframe>
        </div>
      )}

      {image && (
        <div className="changelog-image">
          <img src={changlogImage} />
        </div>
      )}

      {sections.map((section, index) => (
        <React.Fragment key={index}>
          {section.title && (
            <Text
              variant="h1"
              className={`changelog-section-header ${
                headerTypeClasses[section.type] || headerTypeClasses.default
              }`}
            >
              {section.title}
            </Text>
          )}
          {section.body && (
            <Text variant="body" dangerouslySetInnerHTML={{ __html: section.body }} />
          )}
          {section.items && (
            <ul className="changelog-list">
              {section.items.map((item, itemIndex) => (
                <li key={itemIndex} className="changelog-list-item">
                  <Text variant="body" dangerouslySetInnerHTML={{ __html: item }} />
                </li>
              ))}
            </ul>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
