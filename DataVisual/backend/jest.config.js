export default {
    testEnvironment: 'node',
    transform: {},
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
    },
    setupFiles: ['<rootDir>/tests/setup.js'],
    testMatch: ['**/tests/**/*.test.js'],
    verbose: true,
    collectCoverage: false
};
