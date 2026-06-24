// Environment configuration for ATS integration
export const ENV_CONFIG = {
  // ATS API Configuration
  ATS_API_URL: process.env.NEXT_PUBLIC_ATS_API_URL || 'https://api.example.com',
  ATS_API_KEY: process.env.NEXT_PUBLIC_ATS_API_KEY || '',
  
  // Development mode - when true, uses mock data
  IS_DEVELOPMENT: process.env.NODE_ENV === 'development',
  
  // Feature flags
  ENABLE_ATS_INTEGRATION: process.env.NEXT_PUBLIC_ENABLE_ATS === 'true',
  
  // Mock data settings
  USE_MOCK_DATA: !process.env.NEXT_PUBLIC_ATS_API_KEY || process.env.NEXT_PUBLIC_ATS_API_KEY === '',
  
  // Debug settings
  DEBUG_ATS: process.env.NEXT_PUBLIC_DEBUG_ATS === 'true',
};

// Helper function to check if ATS is properly configured
export const isATSConfigured = (): boolean => {
  return !ENV_CONFIG.USE_MOCK_DATA && !!ENV_CONFIG.ATS_API_KEY;
};

// Helper function to get API status
export const getAPIStatus = (): 'configured' | 'mock' | 'error' => {
  if (ENV_CONFIG.USE_MOCK_DATA) {
    return 'mock';
  }
  
  if (ENV_CONFIG.ATS_API_KEY && ENV_CONFIG.ATS_API_URL) {
    return 'configured';
  }
  
  return 'error';
};

// Console logging for development
export const logATSStatus = () => {
  if (ENV_CONFIG.DEBUG_ATS) {
    console.log('🔧 ATS Integration Status:', {
      apiUrl: ENV_CONFIG.ATS_API_URL,
      hasApiKey: !!ENV_CONFIG.ATS_API_KEY,
      useMockData: ENV_CONFIG.USE_MOCK_DATA,
      status: getAPIStatus()
    });
  }
};

