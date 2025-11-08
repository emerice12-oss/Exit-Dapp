// src/components/ConnectWallet.jsx
import React from "react";
import { ethers } from "ethers";
import contractAddress from "../config/contract-address.json";
import ExitVaultAbi from "../config/ExitVault.abi.json";

export default function ConnectWallet({ onConnected }) {
  const connectWallet = async () => {
    try {
      if (!window.ethereum) {
        alert("MetaMask not detected");
        return;
      }

      const prov = new ethers.BrowserProvider(window.ethereum);
      await prov.send("eth_requestAccounts", []);
      const signer = await prov.getSigner();
      const addr = await signer.getAddress();

      // instantiate contract with signer for read/write
      const vault = new ethers.Contract(
        contractAddress.ExitVault,
        ExitVaultAbi.abi ?? ExitVaultAbi,
        signer
      );

      // pass things up to App
      onConnected?.({ provider: prov, signer, contract: vault, address: addr });
    } catch (err) {
      console.error("connectWallet error:", err);
      alert("Failed to connect wallet: " + (err?.message ?? err));
    }
  };

  return (
    <div style={{ marginBottom: "1rem" }}>
      <button onClick={connectWallet} style={{
        padding: "8px 14px",
        background: "green",
        color: "white",
        border: "none",
        borderRadius: "8px",
        cursor: "pointer"
      }}>
        Connect Wallet
      </button>
    </div>
  );
}