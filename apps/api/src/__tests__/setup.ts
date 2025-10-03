// Test setup file - runs before all tests
// Set environment variables needed by modules that validate at load time

process.env.API_JWT_SECRET = 'test-secret-key-with-minimum-32-characters-required-for-validation';
process.env.SERVICE_TOKEN = 'test-service-token-with-minimum-32-characters-required-for-validation';
process.env.NODE_ENV = 'test';
