export interface BackendConfig {
  port: number;
  jwtSecret: string;
  encryptionKey: string;
  polygonRpcUrl: string;
  usdtContractAddress: string;
  nodeEnv: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  supabaseEnabled: boolean;
}

export function getBackendConfig(): BackendConfig {
  const nodeEnv = process.env.NODE_ENV || 'development';

  const port = Number(process.env.PORT || 3000);
  const jwtSecret = process.env.JWT_SECRET || `${nodeEnv}-vaultex-jwt-secret`;
  const encryptionKey = process.env.ENCRYPTION_KEY || 'vaultex-default-encryption-key-32B';
  const polygonRpcUrl = process.env.POLYGON_RPC_URL || 'https://rpc-mumbai.maticvigil.com';
  const usdtContractAddress = process.env.USDT_CONTRACT_ADDRESS || '0xc2132D05D31c914a87C6611C10748AEb04B58e8F';
  const supabaseUrl = process.env.SUPABASE_URL?.trim() || undefined;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY?.trim() || undefined;
  const supabaseEnabled = Boolean(supabaseUrl && supabaseAnonKey);

  return {
    port,
    jwtSecret,
    encryptionKey,
    polygonRpcUrl,
    usdtContractAddress,
    nodeEnv,
    supabaseUrl,
    supabaseAnonKey,
    supabaseEnabled,
  };
}
