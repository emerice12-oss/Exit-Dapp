// src/App.jsx
import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import ConnectWallet from "./components/ConnectWallet";
import contractAddress from "./config/contract-address.json";
import ExitVaultAbi from "./config/ExitVault.abi.json";

/**
 * Make sure:
 * - frontend/src/config/contract-address.json exists and contains { "ExitVault": "0x..." }
 * - frontend/src/config/ExitVault.abi.json exists and contains the ABI (or full artifact)
 */

const EXPLORER_BY_CHAIN = {
  1: "https://etherscan.io",
  5: "https://goerli.etherscan.io",
  11155111: "https://sepolia.etherscan.io",
};

function explorerBaseForChain(chainId) {
  return EXPLORER_BY_CHAIN[chainId] ?? "https://etherscan.io";
}

export default function App() {
  const [account, setAccount] = useState(null);
  const [provider, setProvider] = useState(null);
  const [contract, setContract] = useState(null);
  const [balance, setBalance] = useState("0");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [txStatus, setTxStatus] = useState(null); // null | "pending" | "confirmed" | "failed"
  const [txHash, setTxHash] = useState(null);
  const [message, setMessage] = useState("");
  const [explorerBase, setExplorerBase] = useState(EXPLORER_BY_CHAIN[1]); // default to mainnet explorer

  // Callback from ConnectWallet component
  const handleConnected = async ({ provider: prov, signer, contract: vault, address }) => {
    setProvider(prov);
    setAccount(address);
    setContract(vault);
    setMessage("Wallet connected: " + address);

    try {
      const net = await prov.getNetwork();
      setExplorerBase(explorerBaseForChain(net.chainId));
    } catch (err) {
      console.warn("Could not get network for explorer base:", err);
    }

    // Fetch initial vault balance
    await fetchVaultBalance(vault, address);
  };

  // Fetch vault balance using contract.balances(address)
  const fetchVaultBalance = async (vault = contract, addr = account) => {
    try {
      if (!vault || !addr) return;
      setLoading(true);
      const raw = await vault.balances(addr); // expects mapping or view balances(address)
      const eth = ethers.formatEther(raw);
      setBalance(eth);
      setMessage("Balance updated");
    } catch (err) {
      console.error("fetchVaultBalance error:", err);
      setMessage("Failed to fetch balance: " + (err?.message ?? err));
    } finally {
      setLoading(false);
    }
  };

  // Improved invest flow
  const invest = async () => {
    if (!contract) {
      setMessage("Connect wallet first");
      return;
    }
    if (!amount || Number(amount) <= 0) {
      setMessage("Enter a valid amount in ETH");
      return;
    }

    try {
      setTxStatus(null);
      setTxHash(null);
      setLoading(true);
      setMessage("Preparing transaction...");

      const value = ethers.parseEther(amount.toString());
      const txResponse = await contract.invest({ value });

      // immediate feedback
      setTxStatus("pending");
      setTxHash(txResponse.hash);
      setMessage("Transaction submitted. Waiting for confirmation...");
      console.log("invest txResponse:", txResponse);

      const receipt = await txResponse.wait(); // wait for 1 confirmation
      console.log("invest receipt:", receipt);

      if (receipt && receipt.status === 1) {
        setTxStatus("confirmed");
        setMessage(`Investment confirmed — Tx: ${txResponse.hash}`);
      } else {
        setTxStatus("failed");
        setMessage(`Transaction failed (receipt.status !== 1). Tx: ${txResponse.hash}`);
      }

      await fetchVaultBalance(contract, account);
      setAmount("");
    } catch (err) {
      console.error("invest error:", err);
      if (err?.code === 4001 || err?.data?.code === 4001) {
        setMessage("Transaction rejected by user.");
      } else {
        setMessage("Investment failed: " + (err?.reason || err?.message || err));
      }
      setTxStatus("failed");
    } finally {
      setLoading(false);
    }
  };

  // Improved withdraw flow
  const withdraw = async () => {
    if (!contract) {
      setMessage("Connect wallet first");
      return;
    }

    try {
      setTxStatus(null);
      setTxHash(null);
      setLoading(true);
      setMessage("Submitting withdrawal...");

      const txResponse = await contract.withdraw();
      setTxStatus("pending");
      setTxHash(txResponse.hash);
      setMessage("Withdrawal submitted. Waiting for confirmation...");
      console.log("withdraw txResponse:", txResponse);

      const receipt = await txResponse.wait();
      console.log("withdraw receipt:", receipt);

      if (receipt && receipt.status === 1) {
        setTxStatus("confirmed");
        setMessage(`Withdrawal confirmed — Tx: ${txResponse.hash}`);
      } else {
        setTxStatus("failed");
        setMessage(`Withdrawal failed — Tx: ${txResponse.hash}`);
      }

      await fetchVaultBalance(contract, account);
    } catch (err) {
      console.error("withdraw error:", err);
      if (err?.code === 4001 || err?.data?.code === 4001) {
        setMessage("Transaction rejected by user.");
      } else {
        setMessage("Withdrawal failed: " + (err?.reason || err?.message || err));
      }
      setTxStatus("failed");
    } finally {
      setLoading(false);
    }
  };

  // Listen for account changes
  useEffect(() => {
    if (!window.ethereum) return;
    const onAccountsChanged = (accounts) => {
      if (!accounts || accounts.length === 0) {
        setAccount(null);
        setContract(null);
        setMessage("Disconnected");
      } else {
        setAccount(accounts[0]);
        setMessage("Account changed: " + accounts[0]);
        if (contract) fetchVaultBalance(contract, accounts[0]);
      }
    };

    const onChainChanged = (chainId) => {
      // chainId is hex string
      try {
        const dec = parseInt(chainId, 16);
        setExplorerBase(explorerBaseForChain(dec));
        setMessage("Network changed: " + dec);
      } catch (err) {
        console.warn("chain change parse error", err);
      }
    };

    window.ethereum.on?.("accountsChanged", onAccountsChanged);
    window.ethereum.on?.("chainChanged", onChainChanged);

    return () => {
      window.ethereum.removeListener?.("accountsChanged", onAccountsChanged);
      window.ethereum.removeListener?.("chainChanged", onChainChanged);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contract]);

  return (
    <div style={{ textAlign: "center", marginTop: "60px", fontFamily: "sans-serif" }}>
      <div style={{ marginBottom: "20px" }}>
        <h1>ExitVault Dashboard</h1>
        <ConnectWallet
          onConnected={({ provider: prov, signer, contract: vault, address }) =>
            handleConnected({ provider: prov, signer, contract: vault, address })
          }
        />
      </div>

      {account ? (
        <>
          <p style={{ wordBreak: "break-all" }}>
            <strong>Connected:</strong> {account}
          </p>

          <p>
            <strong>Balance:</strong> {balance} ETH
            <button
              onClick={() => fetchVaultBalance()}
              style={{ marginLeft: 10, padding: "6px 10px", borderRadius: 6 }}
              disabled={loading}
            >
              Refresh
            </button>
          </p>

          <div style={{ marginTop: 12 }}>
            <input
              type="number"
              placeholder="Enter amount in ETH"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={{
                padding: "8px",
                width: "180px",
                borderRadius: "6px",
                border: "1px solid #ccc",
                marginRight: 8,
              }}
              disabled={loading}
            />
            <button onClick={invest} disabled={loading} style={btn}>
              {loading && txStatus === "pending" ? "Working..." : "Invest"}
            </button>
            <button onClick={withdraw} disabled={loading} style={{ ...btn, marginLeft: 8 }}>
              {loading && txStatus === "pending" ? "Working..." : "Withdraw"}
            </button>
          </div>

          {/* Tx status area */}
          {txStatus && (
            <div style={{ marginTop: 12 }}>
              <strong>Status:</strong>{" "}
              {txStatus === "pending" && <span>Pending ⏳</span>}
              {txStatus === "confirmed" && <span>Confirmed ✅</span>}
              {txStatus === "failed" && <span style={{ color: "red" }}>Failed ❌</span>}
            </div>
          )}

          {/* Tx hash + explorer link */}
          {txHash && (
            <div style={{ marginTop: 8 }}>
              <div>
                Tx: <code style={{ wordBreak: "break-all" }}>{txHash}</code>
              </div>
              <div style={{ marginTop: 6 }}>
                <a href={`${explorerBase}/tx/${txHash}`} target="_blank" rel="noreferrer">
                  View on Explorer
                </a>
              </div>
            </div>
          )}
        </>
      ) : (
        <p>Please connect your wallet to interact with the vault.</p>
      )}

      <p style={{ marginTop: 18, color: "#444" }}>{message}</p>
    </div>
  );
}

const btn = {
  margin: "6px",
  padding: "10px 18px",
  background: "green",
  color: "white",
  border: "none",
  borderRadius: "8px",
  cursor: "pointer",
}

const input = {
  padding: "10px",
  marginBottom: "10px",
  width: "200px",
  borderRadius: "8px",
  border: "1px solid gray"
};