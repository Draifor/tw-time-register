// Global test setup file loaded by Vitest before each test suite.
// Add @testing-library/jest-dom matchers so assertions like
// expect(element).toBeInTheDocument() work in renderer tests.
// The `/vitest` entry augments Vitest's own assertion types; Vitest 5 no longer
// reads the global `jest.Matchers` interface that the plain entry targets.
import '@testing-library/jest-dom/vitest';
