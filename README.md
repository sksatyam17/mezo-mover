# Mezo Mover

Minimal wallet-connected web app for moving Mezo ERC20 balances and ERC721 positions.

## Setup

1. Install dependencies with `npm install`
2. Copy `.env.example` to `.env`
3. Fill in the Mezo mainnet RPC URL only if you want to override the default mainnet endpoint
4. Start the app with `npm run dev`

## Features

- Wallet connect with `wagmi`
- `Tokens` tab for the predefined BTC, MEZO, MUSD, mcbBTC, mUSDC, mUSDT, and mSolvBTC contracts
- `Positions` tab for veBTC and veMEZO NFTs fetched with `balanceOf` and `tokenOfOwnerByIndex`
- Minimal move flow with recipient input, confirmation, and transfer execution

## Notes

- ERC20 moves transfer the full displayed token balance
- ERC721 moves call `safeTransferFrom`
- No backend, storage, or address book
