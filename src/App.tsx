import { useEffect, useMemo, useState } from "react";
import {
  Address,
  erc20Abi,
  formatUnits,
  getAddress,
  Hash,
  isAddress,
  parseUnits,
} from "viem";
import {
  useAccount,
  useChainId,
  useConnect,
  useDisconnect,
  usePublicClient,
  useSwitchChain,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import mezoLogo from "./assets/mezo-logo.png";

type TabKey = "tokens" | "positions";
type AppRoute = "home" | "tutorial";

type TokenConfig = {
  address: Address;
  symbol: string;
  fallbackDecimals: number;
};

type PositionConfig = {
  address: Address;
  label: Position["contract"];
};

type TokenAsset = TokenConfig & {
  type: "erc20";
  balance: bigint;
  decimals: number;
  displayBalance: string;
  canMove: boolean;
};

type Position = {
  contract: "veBTC" | "veMEZO";
  contractAddress: string;
  tokenId: bigint;
  amount: bigint;
  unlockTime: number;
  isPermanent: boolean;
  votingPower: bigint;
};

type PositionAsset = Position & {
  type: "erc721";
};

type Asset = TokenAsset | PositionAsset;

const VOTING_ESCROW_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "ownerToNFTokenIdList",
    stateMutability: "view",
    inputs: [
      { name: "", type: "address" },
      { name: "", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "locked",
    stateMutability: "view",
    inputs: [{ name: "_tokenId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "amount", type: "int128" },
          { name: "end", type: "uint256" },
          { name: "isPermanent", type: "bool" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "votingPowerOfNFT",
    stateMutability: "view",
    inputs: [{ name: "_tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "ownerOf",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "safeTransferFrom",
    stateMutability: "nonpayable",
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "tokenId", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

const VOTING_ESCROW_LOCKED_WITHOUT_PERMANENT_ABI = [
  {
    type: "function",
    name: "locked",
    stateMutability: "view",
    inputs: [{ name: "_tokenId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "amount", type: "int128" },
          { name: "end", type: "uint256" },
        ],
      },
    ],
  },
] as const;

const ERC721_TRANSFER_ABI = [
  {
    type: "function",
    name: "safeTransferFrom",
    stateMutability: "nonpayable",
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "tokenId", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

const ERC721_OWNER_ABI = [
  {
    type: "function",
    name: "ownerOf",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

const TOKENS: TokenConfig[] = [
  {
    address: getAddress(
      import.meta.env.VITE_TOKEN_BTC_ADDRESS ??
        "0x7b7C000000000000000000000000000000000000",
    ),
    symbol: import.meta.env.VITE_TOKEN_BTC_SYMBOL ?? "BTC",
    fallbackDecimals: Number(import.meta.env.VITE_TOKEN_BTC_DECIMALS ?? 8),
  },
  {
    address: getAddress(
      import.meta.env.VITE_TOKEN_MEZO_ADDRESS ??
        "0x7B7c000000000000000000000000000000000001",
    ),
    symbol: import.meta.env.VITE_TOKEN_MEZO_SYMBOL ?? "MEZO",
    fallbackDecimals: Number(import.meta.env.VITE_TOKEN_MEZO_DECIMALS ?? 18),
  },
  {
    address: getAddress(
      import.meta.env.VITE_TOKEN_MUSD_ADDRESS ??
        "0xdD468A1DDc392dcdbEf6db6e34E89AA338F9F186",
    ),
    symbol: import.meta.env.VITE_TOKEN_MUSD_SYMBOL ?? "MUSD",
    fallbackDecimals: Number(import.meta.env.VITE_TOKEN_MUSD_DECIMALS ?? 18),
  },
  {
    address: getAddress(
      import.meta.env.VITE_TOKEN_MCBBTC_ADDRESS ??
        "0x6a7CD8E1384d49f502b4A4CE9aC9eb320835c5d7",
    ),
    symbol: import.meta.env.VITE_TOKEN_MCBBTC_SYMBOL ?? "mcbBTC",
    fallbackDecimals: Number(import.meta.env.VITE_TOKEN_MCBBTC_DECIMALS ?? 8),
  },
  {
    address: getAddress(
      import.meta.env.VITE_TOKEN_MUSDC_ADDRESS ??
        "0x04671C72Aab5AC02A03c1098314b1BB6B560c197",
    ),
    symbol: import.meta.env.VITE_TOKEN_MUSDC_SYMBOL ?? "mUSDC",
    fallbackDecimals: Number(import.meta.env.VITE_TOKEN_MUSDC_DECIMALS ?? 6),
  },
  {
    address: getAddress(
      import.meta.env.VITE_TOKEN_MUSDT_ADDRESS ??
        "0xeB5a5d39dE4Ea42C2Aa6A57EcA2894376683bB8E",
    ),
    symbol: import.meta.env.VITE_TOKEN_MUSDT_SYMBOL ?? "mUSDT",
    fallbackDecimals: Number(import.meta.env.VITE_TOKEN_MUSDT_DECIMALS ?? 6),
  },
  {
    address: getAddress(
      import.meta.env.VITE_TOKEN_MSOLVBTC_ADDRESS ??
        "0xa10aD2570ea7b93d19fDae6Bd7189fF4929Bc747",
    ),
    symbol: import.meta.env.VITE_TOKEN_MSOLVBTC_SYMBOL ?? "mSolvBTC",
    fallbackDecimals: Number(import.meta.env.VITE_TOKEN_MSOLVBTC_DECIMALS ?? 18),
  },
];

const POSITIONS: PositionConfig[] = [
  {
    address: getAddress(
      import.meta.env.VITE_VEBTC_ADDRESS ??
        "0x3D4b1b884A7a1E59fE8589a3296EC8f8cBB6f279",
    ),
    label: "veBTC",
  },
  {
    address: getAddress(
      import.meta.env.VITE_VEMEZO_ADDRESS ??
        "0xb90fdAd3DFD180458D62Cc6acedc983D78E20122",
    ),
    label: "veMEZO",
  },
];

const EIGHT_DECIMAL_SYMBOLS = new Set(["BTC", "mcbBTC", "mSolvBTC"]);

function formatTokenBalance(value: bigint, decimals: number, symbol: string) {
  const formatted = formatUnits(value, decimals);
  const [whole, fraction = ""] = formatted.split(".");
  const precision = EIGHT_DECIMAL_SYMBOLS.has(symbol) ? 8 : 4;
  if (!fraction) {
    return whole;
  }

  const trimmedFraction = fraction.slice(0, precision).replace(/0+$/, "");
  return trimmedFraction ? `${whole}.${trimmedFraction}` : whole;
}

function formatPositionAmount(value: bigint) {
  const formatted = formatUnits(value < 0n ? -value : value, 18);
  const [whole, fraction = ""] = formatted.split(".");
  const trimmedFraction = fraction.slice(0, 4).replace(/0+$/, "");
  const unsigned = trimmedFraction ? `${whole}.${trimmedFraction}` : whole;
  return value < 0n ? `-${unsigned}` : unsigned;
}

function formatUnlockTime(position: Position) {
  if (position.isPermanent || position.unlockTime <= 0) {
    return "Auto Max Locked";
  }

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(position.unlockTime * 1000));
}

function getPositionStatus(position: Position) {
  if (position.isPermanent || position.unlockTime <= 0) {
    return "Permanent";
  }

  return position.unlockTime < Math.floor(Date.now() / 1000)
    ? "Expired"
    : "Active";
}

function getPositionStatusClass(position: Position) {
  return `status-badge ${getPositionStatus(position).toLowerCase()}`;
}

function validateRecipient(value: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(value) && isAddress(value);
}

function createDefaultTokenAssets(): TokenAsset[] {
  return TOKENS.map((token) => ({
    ...token,
    type: "erc20" as const,
    balance: 0n,
    decimals: token.fallbackDecimals,
    displayBalance: "0",
    canMove: false,
  }));
}

function TutorialPage() {
  return (
    <div className="tutorial-shell">
      <header className="tutorial-header">
        <a className="secondary-button button-link" href="/">
          Back
        </a>
        <div className="brand-row">
          <img className="brand-logo" src={mezoLogo} alt="Mezo" />
          <p className="eyebrow">Mezo Mover</p>
        </div>
        <h1>How to Use Mezo Mover</h1>
        <p>Understand your veNFT positions and move them safely.</p>
      </header>

      <main className="tutorial-content">
        <section className="tutorial-section">
          <h2>What Is a Position?</h2>
          <p>
            A position is a locked token represented as an NFT. Each position
            has an amount, unlock time, and voting power. Longer locks generally
            create more voting power.
          </p>
        </section>

        <section className="tutorial-section">
          <h2>Types of Positions</h2>
          <ul>
            <li>
              <strong>Active:</strong> Locked and generating voting power.
            </li>
            <li>
              <strong>Auto Max Locked:</strong> Locked at maximum duration for
              best benefits.
            </li>
            <li>
              <strong>Managed:</strong> Deposited into another protocol and may
              show 0 balance in this app.
            </li>
            <li>
              <strong>Expired:</strong> Unlock time has passed and can be
              withdrawn.
            </li>
          </ul>
        </section>

        <section className="tutorial-section">
          <h2>What Does Move Do?</h2>
          <ul>
            <li>Move transfers ownership of your position NFT.</li>
            <li>It does not unlock tokens.</li>
            <li>It does not change lock duration.</li>
            <li>It simply sends the NFT to another address.</li>
          </ul>
        </section>

        <section className="tutorial-section">
          <h2>How to Use This App</h2>
          <ol>
            <li>Connect your wallet.</li>
            <li>View your positions.</li>
            <li>Click Move.</li>
            <li>Enter the recipient address.</li>
            <li>Confirm the transaction.</li>
          </ol>
        </section>

        <section className="tutorial-section">
          <h2>Important Notes</h2>
          <ul>
            <li>Transfers are irreversible.</li>
            <li>Always double-check the recipient address.</li>
            <li>Managed positions behave differently.</li>
          </ul>
        </section>

        <section className="tutorial-section">
          <h2>Learn More</h2>
          <p>Want to go deeper? Explore Mezo's official guides.</p>
          <div className="resource-links">
            <a href="https://mezo.org/blog" target="_blank" rel="noreferrer">
              Mezo Blog (Official)
            </a>
            <a href="https://mezo.org/docs/" target="_blank" rel="noreferrer">
              Mezo Docs (Official)
            </a>
            <a
              href="https://explorer.mezo.org"
              target="_blank"
              rel="noreferrer"
            >
              Mezo Explorer
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}

function App() {
  const route: AppRoute =
    window.location.pathname.replace(/\/$/, "") === "/tutorial"
      ? "tutorial"
      : "home";
  const mezoChainId = Number(import.meta.env.VITE_CHAIN_ID ?? 31612);
  const explorerBaseUrl =
    import.meta.env.VITE_EXPLORER_URL ?? "https://explorer.mezo.org";
  const [activeTab, setActiveTab] = useState<TabKey>("tokens");
  const [tokenAssets, setTokenAssets] = useState<TokenAsset[]>(createDefaultTokenAssets);
  const [positionAssets, setPositionAssets] = useState<PositionAsset[]>([]);
  const [positionWarnings, setPositionWarnings] = useState<string[]>([]);
  const [positionRefreshNonce, setPositionRefreshNonce] = useState(0);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState<"input" | "confirm">("input");
  const [transferError, setTransferError] = useState<string | null>(null);
  const [isLoadingAssets, setIsLoadingAssets] = useState(false);
  const [submittedHash, setSubmittedHash] = useState<Hash | undefined>();

  const publicClient = usePublicClient();
  const { address, isConnected } = useAccount();
  const connectedChainId = useChainId();
  const {
    connect,
    connectors,
    error: connectError,
    isPending: isConnecting,
  } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChainAsync, isPending: isSwitchingChain } = useSwitchChain();
  const { writeContractAsync, isPending: isSubmitting } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({
    hash: submittedHash,
  });

  const recipientIsValid = useMemo(
    () => validateRecipient(recipient),
    [recipient],
  );
  const amountError = useMemo(() => {
    if (!selectedAsset || selectedAsset.type !== "erc20") {
      return null;
    }

    if (!amount) {
      return "Enter an amount to move.";
    }

    try {
      const parsedAmount = parseUnits(amount, selectedAsset.decimals);

      if (parsedAmount <= 0n) {
        return "Enter an amount greater than 0.";
      }

      if (parsedAmount > selectedAsset.balance) {
        return "Amount exceeds available balance.";
      }

      return null;
    } catch {
      return "Enter a valid token amount.";
    }
  }, [amount, selectedAsset]);
  const canContinue =
    recipientIsValid &&
    (selectedAsset?.type !== "erc20" || amountError === null);
  const isWrongNetwork = isConnected && connectedChainId !== mezoChainId;
  const tokenTransferConfirmed =
    selectedAsset?.type === "erc20" && receipt.isSuccess && Boolean(submittedHash);
  const positionTransferConfirmed =
    selectedAsset?.type === "erc721" && receipt.isSuccess && Boolean(submittedHash);
  const transferConfirmed = tokenTransferConfirmed || positionTransferConfirmed;
  const transactionExplorerUrl = submittedHash
    ? `${explorerBaseUrl.replace(/\/$/, "")}/tx/${submittedHash}`
    : null;

  useEffect(() => {
    if (!isConnected || !address || !publicClient || isWrongNetwork) {
      setTokenAssets(createDefaultTokenAssets());
      setPositionAssets([]);
      setPositionWarnings([]);
      setIsLoadingAssets(false);
      return;
    }

    const connectedAddress = address;
    const client = publicClient;
    let cancelled = false;

    async function loadAssets() {
      try {
        setIsLoadingAssets(true);

        const fetchedTokens = await Promise.all(
          TOKENS.map(async (token) => {
            try {
              const balance = (await client.readContract({
                address: token.address,
                abi: erc20Abi,
                functionName: "balanceOf",
                args: [connectedAddress],
              })) as bigint;
              let decimals = token.fallbackDecimals;

              try {
                decimals = (await client.readContract({
                  address: token.address,
                  abi: erc20Abi,
                  functionName: "decimals",
                })) as number;
              } catch {
                decimals = token.fallbackDecimals;
              }

              return {
                ...token,
                type: "erc20" as const,
                balance,
                decimals,
                displayBalance: formatTokenBalance(balance, decimals, token.symbol),
                canMove: balance > 0n,
              };
            } catch {
              return {
                ...token,
                type: "erc20" as const,
                balance: 0n,
                decimals: token.fallbackDecimals,
                displayBalance: "-",
                canMove: false,
              };
            }
          }),
        );

        const fetchedPositionsNested = await Promise.all(
          POSITIONS.map(async (position) => {
            try {
              const balance = (await client.readContract({
                address: position.address,
                abi: VOTING_ESCROW_ABI,
                functionName: "balanceOf",
                args: [connectedAddress],
              })) as bigint;

              const tokenIds = await Promise.all(
                Array.from({ length: Number(balance) }, async (_, index) => {
                  return (await client.readContract({
                    address: position.address,
                    abi: VOTING_ESCROW_ABI,
                    functionName: "ownerToNFTokenIdList",
                    args: [connectedAddress, BigInt(index)],
                  })) as bigint;
                }),
              );

              const enrichedPositions = await Promise.all(
                tokenIds.map(async (tokenId) => {
                  const [lockedData, votingPower] = await Promise.all([
                    client
                      .readContract({
                        address: position.address,
                        abi: VOTING_ESCROW_ABI,
                        functionName: "locked",
                        args: [tokenId],
                      })
                      .catch(async () => {
                        const fallbackLocked = await client.readContract({
                          address: position.address,
                          abi: VOTING_ESCROW_LOCKED_WITHOUT_PERMANENT_ABI,
                          functionName: "locked",
                          args: [tokenId],
                        });

                        return {
                          amount: fallbackLocked.amount,
                          end: fallbackLocked.end,
                          isPermanent: false,
                        };
                      }),
                    client.readContract({
                      address: position.address,
                      abi: VOTING_ESCROW_ABI,
                      functionName: "votingPowerOfNFT",
                      args: [tokenId],
                    }),
                  ]);

                  return {
                    type: "erc721" as const,
                    contract: position.label,
                    contractAddress: position.address,
                    tokenId,
                    amount: lockedData.amount,
                    unlockTime: Number(lockedData.end),
                    isPermanent: Boolean(lockedData.isPermanent),
                    votingPower: votingPower as bigint,
                  };
                }),
              );

              return {
                positions: enrichedPositions,
                warning: null,
              };
            } catch {
              return {
                positions: [],
                warning: `Failed to load ${position.label} positions`,
              };
            }
          }),
        );

        if (cancelled) {
          return;
        }

        setTokenAssets(fetchedTokens);
        setPositionAssets(
          fetchedPositionsNested.flatMap((result) => result.positions),
        );
        setPositionWarnings(
          fetchedPositionsNested
            .map((result) => result.warning)
            .filter((warning): warning is string => Boolean(warning)),
        );
      } catch {
        if (cancelled) {
          return;
        }

        setTokenAssets(createDefaultTokenAssets());
        setPositionAssets([]);
        setPositionWarnings(POSITIONS.map((position) => `Failed to load ${position.label} positions`));
      } finally {
        if (!cancelled) {
          setIsLoadingAssets(false);
        }
      }
    }

    void loadAssets();

    return () => {
      cancelled = true;
    };
  }, [
    address,
    isConnected,
    isWrongNetwork,
    positionRefreshNonce,
    publicClient,
    receipt.isSuccess,
  ]);

  useEffect(() => {
    if (
      selectedAsset?.type !== "erc721" ||
      !receipt.isSuccess ||
      !submittedHash
    ) {
      return;
    }

    setPositionRefreshNonce((current) => current + 1);
    setTransferError(null);
  }, [receipt.isSuccess, selectedAsset, submittedHash]);

  function closeFlow() {
    setSelectedAsset(null);
    setRecipient("");
    setAmount("");
    setStep("input");
    setTransferError(null);
    setSubmittedHash(undefined);
  }

  function openFlow(asset: Asset) {
    setSelectedAsset(asset);
    setRecipient("");
    setAmount("");
    setStep("input");
    setTransferError(null);
    setSubmittedHash(undefined);
  }

  async function executeTransfer() {
    if (!selectedAsset || !address || !recipientIsValid || !publicClient) {
      return;
    }

    setTransferError(null);

    try {
      if (isWrongNetwork) {
        await switchChainAsync({ chainId: mezoChainId });
      }

      const recipientAddress = getAddress(recipient);

      if (selectedAsset.type === "erc20") {
        const parsedAmount = parseUnits(amount, selectedAsset.decimals);
        const hash = await writeContractAsync({
          chainId: mezoChainId,
          address: selectedAsset.address,
          abi: erc20Abi,
          functionName: "transfer",
          args: [recipientAddress, parsedAmount],
        });
        setSubmittedHash(hash);
      } else {
        const currentOwner = await publicClient.readContract({
          address: selectedAsset.contractAddress as Address,
          abi: ERC721_OWNER_ABI,
          functionName: "ownerOf",
          args: [selectedAsset.tokenId],
        });

        if (getAddress(currentOwner) !== getAddress(address)) {
          throw new Error("Connected wallet no longer owns this position.");
        }

        const hash = await writeContractAsync({
          chainId: mezoChainId,
          address: selectedAsset.contractAddress as Address,
          abi: ERC721_TRANSFER_ABI,
          functionName: "safeTransferFrom",
          args: [address, recipientAddress, selectedAsset.tokenId],
        });
        setSubmittedHash(hash);
      }
    } catch (error) {
      setTransferError(
        error instanceof Error ? error.message : "Transfer failed.",
      );
    }
  }

  const displayedAssets = activeTab === "tokens" ? tokenAssets : positionAssets;
  const connector = connectors.find((item) => item.type === "injected");

  if (route === "tutorial") {
    return <TutorialPage />;
  }

  return (
    <div className="app-shell">
      <div className="app-card">
        <header className="hero">
          <div>
            <div className="brand-row">
              <img className="brand-logo" src={mezoLogo} alt="Mezo" />
              <p className="eyebrow">Mezo Mover</p>
            </div>
            <h1>Move tokens and positions in one fast flow.</h1>
          </div>
          {isConnected ? (
            <button className="secondary-button" onClick={() => disconnect()}>
              Disconnect
            </button>
          ) : (
            <button
              className="primary-button"
              disabled={!connector || isConnecting}
              onClick={() => connector && connect({ connector })}
            >
              {isConnecting ? "Connecting..." : "Connect EVM wallet"}
            </button>
          )}
        </header>

        <section className="wallet-row">
          <span className="wallet-label">Wallet</span>
          <span className="wallet-value">
            {address ?? "Connect a wallet to load assets."}
          </span>
        </section>

        <a className="guide-card" href="/tutorial">
          <span>New to veNFT positions?</span>
          <strong>Open the Mezo Mover guide</strong>
        </a>

        {!isConnected && connectError ? (
          <div className="empty-state error">{connectError.message}</div>
        ) : null}

        {isWrongNetwork ? (
          <div className="empty-state error">
            Switch your wallet to Mezo Mainnet before moving assets.
          </div>
        ) : null}

        <div className="tab-row">
          <button
            className={activeTab === "tokens" ? "tab active" : "tab"}
            onClick={() => setActiveTab("tokens")}
          >
            Tokens
          </button>
          <button
            className={activeTab === "positions" ? "tab active" : "tab"}
            onClick={() => setActiveTab("positions")}
          >
            Positions
          </button>
        </div>

        {activeTab === "positions" && !isConnected ? (
          <div className="empty-state">Connect your wallet to view positions.</div>
        ) : activeTab === "positions" && isWrongNetwork ? (
          <div className="empty-state">Switch to Mezo Mainnet to view positions.</div>
        ) : isLoadingAssets && activeTab === "positions" ? (
          <div className="empty-state">Loading positions...</div>
        ) : displayedAssets.length === 0 ? (
          <>
            {activeTab === "positions" &&
              positionWarnings.map((warning) => (
                <div className="empty-state error" key={warning}>
                  {warning}
                </div>
              ))}
            <div className="empty-state">
              {activeTab === "tokens"
                ? "No token balances found."
                : "No positions found."}
            </div>
          </>
        ) : (
          <div className="asset-list">
            {activeTab === "positions" &&
              positionWarnings.map((warning) => (
                <div className="empty-state error" key={warning}>
                  {warning}
                </div>
              ))}
            {displayedAssets.map((asset) => (
              <article
                className="asset-row"
                key={
                  asset.type === "erc20"
                    ? asset.address
                    : `${asset.contractAddress}-${asset.tokenId.toString()}`
                }
              >
                <div>
                  {asset.type === "erc20" ? (
                    <h2>{asset.symbol}</h2>
                  ) : (
                    <div className="position-header">
                      <h2>
                        {asset.contract} #{asset.tokenId.toString()}
                      </h2>
                      <span className={getPositionStatusClass(asset)}>
                        {getPositionStatus(asset)}
                      </span>
                    </div>
                  )}
                  {asset.type === "erc20" ? (
                    <p className="asset-detail">
                      {asset.displayBalance} {asset.symbol}
                    </p>
                  ) : (
                    <div className="position-detail-grid">
                      <span>
                        <strong>Locked:</strong> {formatPositionAmount(asset.amount)}
                      </span>
                      <span>
                        <strong>Unlock:</strong> {formatUnlockTime(asset)}
                      </span>
                      <span>
                        <strong>Voting Power:</strong>{" "}
                        {formatPositionAmount(asset.votingPower)}
                      </span>
                    </div>
                  )}
                </div>
                <button
                  className="primary-button"
                  disabled={
                    !isConnected ||
                    isWrongNetwork ||
                    (asset.type === "erc20" && !asset.canMove)
                  }
                  onClick={() => openFlow(asset)}
                >
                  Move
                </button>
              </article>
            ))}
          </div>
        )}
      </div>

      {selectedAsset ? (
        <div className="modal-backdrop" onClick={closeFlow}>
          <div
            className="modal-card"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <p className="eyebrow">Transfer</p>
                <h2>
                  {selectedAsset.type === "erc20"
                    ? selectedAsset.symbol
                    : `${selectedAsset.contract} #${selectedAsset.tokenId.toString()}`}
                </h2>
              </div>
              <button className="icon-button" onClick={closeFlow}>
                Close
              </button>
            </div>

            {step === "input" ? (
              <div className="flow-stack">
                <label className="field-label" htmlFor="recipient">
                  Recipient address
                </label>
                <input
                  id="recipient"
                  className="address-input"
                  placeholder="0x..."
                  value={recipient}
                  onChange={(event) => setRecipient(event.target.value.trim())}
                />
                {selectedAsset.type === "erc20" ? (
                  <>
                    <label className="field-label" htmlFor="amount">
                      Amount
                    </label>
                    <input
                      id="amount"
                      className="address-input"
                      inputMode="decimal"
                      placeholder="0.0"
                      value={amount}
                      onChange={(event) => setAmount(event.target.value.trim())}
                    />
                  </>
                ) : null}
                <p className="help-text">
                  {recipient.length === 0
                    ? "Enter the destination wallet address."
                    : recipientIsValid
                      ? recipient
                      : "Enter a valid 42-character hex address starting with 0x."}
                </p>
                {selectedAsset.type === "erc20" ? (
                  <p className="help-text">
                    {amount.length === 0
                      ? `Available: ${selectedAsset.displayBalance} ${selectedAsset.symbol}`
                      : amountError ?? `Available: ${selectedAsset.displayBalance} ${selectedAsset.symbol}`}
                  </p>
                ) : null}
                <button
                  className="primary-button full-width"
                  disabled={!canContinue}
                  onClick={() => setStep("confirm")}
                >
                  Continue
                </button>
              </div>
            ) : (
              <div className="flow-stack">
                <div className="confirm-card">
                  <div>
                    <span className="confirm-label">Asset</span>
                    <span className="confirm-value">
                      {selectedAsset.type === "erc20"
                        ? `${amount} ${selectedAsset.symbol}`
                        : `${selectedAsset.contract} #${selectedAsset.tokenId.toString()}`}
                    </span>
                  </div>
                  <div>
                    <span className="confirm-label">Recipient</span>
                    <span className="confirm-value break-all">{recipient}</span>
                  </div>
                </div>

                {transferError ? (
                  <div className="empty-state error">{transferError}</div>
                ) : null}

                {submittedHash ? (
                  <div className="status-card">
                    <span>Transaction</span>
                    <span className="break-all">{submittedHash}</span>
                    <span>
                      {receipt.isLoading
                        ? "Pending confirmation..."
                        : receipt.isSuccess
                          ? "Transfer complete."
                          : "Submitted."}
                    </span>
                  </div>
                ) : null}

                <div className="action-row">
                  {transferConfirmed ? (
                    <>
                      <button className="secondary-button" onClick={closeFlow}>
                        Close
                      </button>
                      {transactionExplorerUrl ? (
                        <a
                          className="primary-button button-link"
                          href={transactionExplorerUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          View on Mezo Explorer
                        </a>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <button
                        className="secondary-button"
                        onClick={() => setStep("input")}
                      >
                        Back
                      </button>
                      <button
                        className="primary-button"
                        disabled={
                          isSubmitting ||
                          isSwitchingChain ||
                          receipt.isLoading ||
                          isWrongNetwork ||
                          !recipientIsValid ||
                          (selectedAsset.type === "erc20" && amountError !== null)
                        }
                        onClick={() => void executeTransfer()}
                      >
                        {isSubmitting || isSwitchingChain || receipt.isLoading
                          ? "Sending..."
                          : "Confirm move"}
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default App;
