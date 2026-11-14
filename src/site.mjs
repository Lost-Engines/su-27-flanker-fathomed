// No third-party scripts, remote fonts or analytics are required by the site.
for (const link of document.querySelectorAll('a[href^="#"]')) link.addEventListener('click', () => {
  const element = document.getElementById(decodeURIComponent(link.hash.slice(1)));
  if (element && !element.hasAttribute('tabindex')) element.setAttribute('tabindex','-1');
});
