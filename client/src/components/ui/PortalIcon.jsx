export default function PortalIcon({ name }) {
  const paths = {
    news: (
      <>
        <path d="M5 5h14v14H5zM8 8h8M8 15h8M8 11h3M14 11h2" />
        <path d="M3 9v11a1 1 0 0 0 1 1h15" />
      </>
    ),
    community: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6M21 20v-3a6 6 0 0 0-4-5" />
      </>
    ),
    search: (
      <>
        <circle cx="10" cy="10" r="6" />
        <path d="M15 15l6 6" />
      </>
    ),
    arrow: <path d="M6 18 18 6M6 6h12v12" />,
  }
  return (
    <svg
      className="portal-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || paths.news}
    </svg>
  )
}
