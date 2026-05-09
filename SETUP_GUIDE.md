# ParkFi Setup and Deployment Guide

This guide will help you deploy and run the ParkFi smart contracts and React frontend locally.

## Prerequisites

- Node.js 16+ (with npm or yarn)
- MetaMask browser extension
- A code editor (VS Code recommended)
- Basic understanding of blockchain and smart contracts

## Step 1: Smart Contract Setup

### 1.1 Deploy Contracts Locally

Navigate to the contracts directory:
```bash
cd contracts
npm install
```

Start a local Hardhat blockchain:
```bash
npx hardhat node
```

This will start a local blockchain at `http://127.0.0.1:8545` with 20 pre-funded test accounts.

### 1.2 Deploy Contracts

In a new terminal, from the contracts directory:
```bash
npm run deploy:local
```

**Important**: Save the contract addresses from the deployment output. You'll need them for the frontend configuration.

Expected output:
```
Deploying contracts with account: 0x...
ParkingRegistry deployed to: 0x...
ParkingPermitNFT deployed to: 0x...
BookingManager deployed to: 0x...
```

## Step 2: MetaMask Configuration

### 2.1 Add Localhost Network

1. Open MetaMask
2. Click network selector (top-left)
3. Click "Add a custom network"
4. Fill in the network details:
   - Network name: Hardhat
   - RPC URL: http://127.0.0.1:8545
   - Chain ID: 31337
   - Currency: ETH
5. Click "Save"

### 2.2 Import Test Account

1. In the Hardhat node output, you'll see test accounts with private keys
2. In MetaMask, click account icon → "Import Account"
3. Paste a private key from Hardhat
4. Click "Import"

Now you have ETH in your test account for transactions!

## Step 3: Frontend Setup

### 3.1 Install Dependencies

Navigate to the frontend directory:
```bash
cd frontend
npm install
```

### 3.2 Configure Contract Addresses

1. Create or update `.env` with your deployed contract addresses:

```bash
REACT_APP_BOOKING_MANAGER_ADDRESS=0x0B306BF915C4d645ff596e81fCb0DF485dc1EC6F
```

Replace with your actual deployed addresses from Step 1.2.

### 3.3 Start Frontend Development Server

```bash
npm start
```

The app will open at `http://localhost:3000`

## Step 4: Using the Application

### 4.1 Connect Wallet

1. Click "Connect Wallet" button
2. Select your imported MetaMask account
3. Approve the connection
4. Verify you're on the "Hardhat" network

### 4.2 Create a Parking Spot

1. Click "Create Spot" tab
2. Fill in the form:
   - Location Name: "Downtown Parking"
   - Description: "Premium parking near downtown"
   - Latitude: 40.7128 (New York example)
   - Longitude: -74.0060
   - Price per Hour: 0.01 ETH
   - Capacity: 10
3. Click "Create Parking Spot"
4. Approve the transaction in MetaMask
5. Wait for confirmation

### 4.3 View Available Spots

1. Click "Browse Spots" tab
2. View all created parking spots
3. See details like price, location, and capacity

### 4.4 Book a Parking Spot

1. Click "Book Now" on a parking spot
2. Fill in booking details:
   - Start Date/Time
   - End Date/Time
3. Review the calculated cost
4. Click "Book Now"
5. Approve the transaction in MetaMask
6. Wait for confirmation

## Common Issues and Solutions

### Issue: MetaMask shows "Wrong Network"
- **Solution**: Switch to Hardhat network in MetaMask (or add it if not present)

### Issue: "Contract not initialized"
- **Solution**: Verify contract addresses in `.env.local` are correct and match deployed addresses

### Issue: Transactions fail with "insufficient funds"
- **Solution**: Import another test account from Hardhat that has more ETH

### Issue: Can't connect wallet
- **Solution**: 
  - Unlock MetaMask
  - Clear browser cache and refresh
  - Try importing the account again

### Issue: Hardhat blockchain stopped responding
- **Solution**: 
  - Stop the Hardhat node (Ctrl+C)
  - Start it again with `npx hardhat node`
  - Refresh the browser

## Testing Workflow

1. **Deploy contracts** on local blockchain
2. **Start frontend** development server
3. **Connect wallet** with test account
4. **Create parking spots** with various details
5. **Browse and book** parking spots
6. **Monitor transactions** in MetaMask

## Project Structure

```
├── contracts/               # Smart contracts
│   ├── contracts/          # Solidity files
│   ├── scripts/            # Deployment scripts
│   ├── test/               # Contract tests
│   └── hardhat.config.js   # Hardhat configuration
│
└── frontend/               # React application
    ├── src/
    │   ├── components/     # React components
    │   ├── context/        # Contract context
    │   ├── config/         # Configuration
    │   └── utils/          # Helper functions
    ├── public/             # Static files
    └── package.json        # Dependencies
```

## Environment Variables

### Frontend (.env.local)

```
REACT_APP_PARKING_REGISTRY_ADDRESS=0x...
REACT_APP_BOOKING_MANAGER_ADDRESS=0x...
REACT_APP_PARKING_PERMIT_NFT_ADDRESS=0x...
```

### Contracts (.env) - if needed

```
DEPLOYER_PRIVATE_KEY=your_private_key
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/your_infura_key
```

## Next Steps

1. **Add authentication**: Implement user profiles and booking history
2. **Add analytics**: Track parking spot usage and revenue
3. **Deploy to testnet**: Try Sepolia or other test networks
4. **Add UI enhancements**: Maps integration, real-time notifications
5. **Implement payments**: Accept multiple payment methods

## Additional Resources

- [Hardhat Documentation](https://hardhat.org/)
- [ethers.js Documentation](https://docs.ethers.org/v6/)
- [React Documentation](https://react.dev/)
- [MetaMask Documentation](https://docs.metamask.io/)

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review contract test files for usage examples
3. Check browser console for error messages
4. Verify all addresses and configurations are correct

## License

MIT License
