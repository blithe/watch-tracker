import '@testing-library/jest-dom'

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
    }
  },
  useSearchParams() {
    return {
      get: jest.fn(() => null),
    }
  },
  usePathname() {
    return ''
  },
}))

// Mock file system operations for upload tests
jest.mock('fs/promises', () => ({
  writeFile: jest.fn().mockResolvedValue(undefined),
}))

// Set test environment variables
process.env.NODE_ENV = 'test'