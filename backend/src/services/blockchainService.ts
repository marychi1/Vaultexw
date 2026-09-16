import { Contract, ethers, JsonRpcProvider, Wallet } from 'ethers';
import { getBackendConfig } from '../config';

const { polygonRpcUrl: POLYGON_RPC_URL, usdtContractAddress: USDT_CONTRACT_ADDRESS } = getBackendConfig();

const USDT_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
];

class BlockchainService {
  private static provider = new JsonRpcProvider(POLYGON_RPC_URL);

  static generateWallet() {
    const wallet = Wallet.createRandom();
    return {
      walletAddress: wallet.address,
      encryptedPrivateKey: wallet.privateKey,
      mnemonic: wallet.mnemonic ? wallet.mnemonic.phrase : null,
    };
  }

  static async getUSDTBalance(address: string): Promise<number> {
    if (!address) return 0;

    try {
      const contract = new Contract(USDT_CONTRACT_ADDRESS, USDT_ABI, this.provider);
      const balance = await contract.balanceOf(address);
      const decimals = await contract.decimals();
      return Number(ethers.formatUnits(balance.toString(), decimals));
    } catch {
      return 0;
    }
  }

  static async sendUSDT(toAddress: string, amount: number, privateKey: string): Promise<{ txHash: string; status: 'completed' | 'pending' | 'failed' }> {
    if (!toAddress || !amount || !privateKey) {
      throw new Error('Recipient address, amount, and private key are required');
    }

    try {
      const wallet = new Wallet(privateKey, this.provider);
      const contract = new Contract(USDT_CONTRACT_ADDRESS, USDT_ABI, wallet);
      const decimals = await contract.decimals();
      const parsedAmount = ethers.parseUnits(amount.toString(), decimals);
      const tx = await contract.transfer(toAddress, parsedAmount);
      await tx.wait();
      return { txHash: tx.hash, status: 'completed' };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Transfer failed';
      throw new Error(message);
    }
  }
}

export default BlockchainService;
