import '@testing-library/jest-dom/vitest'

import { afterEach } from 'vitest'

// Each test starts with a separate browser session.
afterEach(() => window.sessionStorage.clear())
