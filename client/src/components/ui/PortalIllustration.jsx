export default function PortalIllustration({ compact }) {
  return (
    <svg
      className={compact ? 'portal-art portal-art-compact' : 'portal-art'}
      viewBox="0 0 680 480"
      fill="none"
      aria-hidden="true"
    >
      <rect width="680" height="480" fill="#f3ede8" />
      <path d="M400 0h280v480H180z" fill="#e9ddd4" />
      <circle cx="533" cy="95" r="138" fill="#e30613" opacity=".12" />
      <path d="M60 391h566M87 410h512" stroke="#cdbeb2" strokeWidth="2" />
      <path d="M138 330V162l184-54 184 54v168" fill="#fff" stroke="#bca99b" strokeWidth="3" />
      <path d="M111 172l211-64 211 64" stroke="#e30613" strokeWidth="12" />
      <path d="M173 203h67v62h-67zM403 203h67v62h-67z" fill="#efe8e3" />
      <path d="M267 183h110v147H267z" fill="#e30613" />
      <path d="M322 183v147M283 253h13M348 253h13" stroke="#fff" strokeWidth="3" />
      <path d="M156 331h331v19H156zM139 351h366v19H139z" fill="#cbb6a8" />
      <path d="M173 234h67M207 203v62M403 234h67M437 203v62" stroke="#c5b3a6" strokeWidth="2" />
      <rect
        x="475"
        y="288"
        width="102"
        height="79"
        rx="3"
        fill="#fff"
        stroke="#e30613"
        strokeWidth="3"
      />
      <path d="M488 308h76M488 320h76M488 332h47" stroke="#d3c4b8" strokeWidth="3" />
      <path d="M518 368v23M497 393h46" stroke="#e30613" strokeWidth="5" />
      <circle cx="107" cy="273" r="27" fill="#64766c" />
      <circle cx="91" cy="248" r="24" fill="#7c8c77" />
      <circle cx="120" cy="243" r="29" fill="#81917d" />
      <path d="M108 270v111" stroke="#756458" strokeWidth="6" />
      <path d="M88 380h40l-5 11H93z" fill="#d2b6a3" />
      <path d="M570 374l17-38 18 38M578 354h19" stroke="#e30613" strokeWidth="3" />
      <circle cx="590" cy="299" r="12" fill="#e30613" opacity=".2" />
      <path
        d="M126 125l-22-22M550 190l23-9M491 90l6-26"
        stroke="#e30613"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  )
}
