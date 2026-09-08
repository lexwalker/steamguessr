// Small inline SVG flags (emoji flags do not render on Windows).
const W = 28;
const H = 20;

function Frame({ children, label }) {
  return (
    <svg className="flag" width={W} height={H} viewBox="0 0 28 20" role="img" aria-label={label}>
      {children}
    </svg>
  );
}

const FLAGS = {
  ru: (l) => (
    <Frame label={l}><rect width="28" height="20" fill="#fff" /><rect y="6.67" width="28" height="6.66" fill="#0039a6" /><rect y="13.33" width="28" height="6.67" fill="#d52b1e" /></Frame>
  ),
  en: (l) => (
    <Frame label={l}>
      <rect width="28" height="20" fill="#012169" />
      <path d="M0 0l28 20M28 0L0 20" stroke="#fff" strokeWidth="4" />
      <path d="M0 0l28 20M28 0L0 20" stroke="#c8102e" strokeWidth="1.6" />
      <path d="M14 0v20M0 10h28" stroke="#fff" strokeWidth="6" />
      <path d="M14 0v20M0 10h28" stroke="#c8102e" strokeWidth="3.4" />
    </Frame>
  ),
  zh: (l) => (
    <Frame label={l}>
      <rect width="28" height="20" fill="#de2910" />
      <polygon points="5,3 6.2,6.6 10,6.6 6.9,8.8 8.1,12.4 5,10.2 1.9,12.4 3.1,8.8 0,6.6 3.8,6.6" fill="#ffde00" />
      <circle cx="11" cy="3" r="0.9" fill="#ffde00" /><circle cx="13" cy="5" r="0.9" fill="#ffde00" /><circle cx="13" cy="8" r="0.9" fill="#ffde00" /><circle cx="11" cy="10" r="0.9" fill="#ffde00" />
    </Frame>
  ),
  ja: (l) => (
    <Frame label={l}><rect width="28" height="20" fill="#fff" /><circle cx="14" cy="10" r="6" fill="#bc002d" /></Frame>
  ),
  ko: (l) => (
    <Frame label={l}>
      <rect width="28" height="20" fill="#fff" />
      <circle cx="14" cy="10" r="5.2" fill="#cd2e3a" />
      <path d="M8.8 10a5.2 5.2 0 0 0 10.4 0 2.6 2.6 0 0 0-5.2 0 2.6 2.6 0 0 1-5.2 0z" fill="#0047a0" />
      <g stroke="#000" strokeWidth="1"><path d="M3.5 4.2l3 2M3.5 5.8l3 2M3.5 7.4l3 2" /><path d="M21.5 4.2l3-2M21.5 5.8l3-2M21.5 7.4l3-2" transform="translate(0 10)" /></g>
    </Frame>
  ),
  de: (l) => (
    <Frame label={l}><rect width="28" height="6.67" fill="#000" /><rect y="6.67" width="28" height="6.66" fill="#dd0000" /><rect y="13.33" width="28" height="6.67" fill="#ffce00" /></Frame>
  ),
  fr: (l) => (
    <Frame label={l}><rect width="9.33" height="20" fill="#0055a4" /><rect x="9.33" width="9.34" height="20" fill="#fff" /><rect x="18.67" width="9.33" height="20" fill="#ef4135" /></Frame>
  ),
  es: (l) => (
    <Frame label={l}><rect width="28" height="20" fill="#aa151b" /><rect y="5" width="28" height="10" fill="#f1bf00" /></Frame>
  ),
  pt: (l) => (
    <Frame label={l}>
      <rect width="28" height="20" fill="#009c3b" />
      <polygon points="14,2 26,10 14,18 2,10" fill="#ffdf00" />
      <circle cx="14" cy="10" r="4.6" fill="#002776" />
      <path d="M9.6 9.2q4.4-1.6 8.8 1" stroke="#fff" strokeWidth="0.9" fill="none" />
    </Frame>
  ),
  pl: (l) => (
    <Frame label={l}><rect width="28" height="10" fill="#fff" /><rect y="10" width="28" height="10" fill="#dc143c" /></Frame>
  ),
  tr: (l) => (
    <Frame label={l}>
      <rect width="28" height="20" fill="#e30a17" />
      <circle cx="11" cy="10" r="5.5" fill="#fff" /><circle cx="12.4" cy="10" r="4.4" fill="#e30a17" />
      <polygon points="17.5,7.3 18.3,9.6 20.7,9.6 18.8,11 19.5,13.3 17.5,11.9 15.5,13.3 16.2,11 14.3,9.6 16.7,9.6" fill="#fff" />
    </Frame>
  ),
};

export default function Flag({ code, label }) {
  const draw = FLAGS[code] || FLAGS.en;
  return draw(label || code);
}
