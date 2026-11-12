export const config = {
  contractId: import.meta.env.VITE_CONTRACT_ID || '',
  nearNetwork: import.meta.env.VITE_NEAR_NETWORK || 'testnet',
  relayerUrl: import.meta.env.VITE_RELAYER_URL || '',
} as const;
