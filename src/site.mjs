// No third-party scripts, remote fonts or analytics are required by the site.
for (const link of document.querySelectorAll('a[href^="#"]')) link.addEventListener('click', () => {
  const element = document.getElementById(decodeURIComponent(link.hash.slice(1)));
  if (element && !element.hasAttribute('tabindex')) element.setAttribute('tabindex','-1');
});

// Preserve links to article sections that previously lived on the landing page.
const storySections = document.getElementById('story-sections');
if (storySections) {
  const anchors = JSON.parse(storySections.textContent);
  const followArticleLink = () => {
    if (anchors.includes(location.hash.slice(1))) location.replace(new URL('story/' + location.hash, location.href));
  };
  followArticleLink();
  addEventListener('hashchange', followArticleLink);
}
