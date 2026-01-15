export default function () {
  const userAgent = window.navigator.userAgent;

  if (!userAgent || typeof userAgent !== 'string') {
    return 'Unknown';
  }

  // The order should be important!
  const browserPatterns = [
    { regex: /Edg\/([\d.]+)/, name: 'Edge' },
    { regex: /(?:OPR|Opera)\/([\d.]+)/, name: 'Opera' },
    { regex: /Firefox\/([\d.]+)/, name: 'Firefox' },
    { regex: /(?:MSIE |Trident\/.*; rv:)([\d.]+)/, name: 'Internet Explorer' },
    { regex: /Chrome\/([\d.]+)/, name: 'Chromium' },
    { regex: /Version\/([\d.]+) Safari/, name: 'Safari' },
  ];

  for (const browser of browserPatterns) {
    const match = userAgent.match(browser.regex);

    if (match && match[1]) {
      const majorVersion = match[1].split('.')[0];
      return `${browser.name} ${majorVersion}`;
    }
  }

  return 'Unknown';
}
