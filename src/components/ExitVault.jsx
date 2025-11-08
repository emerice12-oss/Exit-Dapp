// ExitVaultUI.jsx
// Single-file React component (default export) using ethers (v6) and Tailwind CSS.
// Paste this into your React app (e.g., src/components/ExitVaultUI.jsx) and use <ExitVaultUI />.
// Requirements: ethers (v6), Tailwind set up, MetaMask or any injected wallet.

import React, { useEffect, useState } from "react";
import { ethers } from "ethers";

// --- CONFIG ---
const CONTRACT_ADDRESS = "0x0b510b9C009252a6B2318789DE45A5353DFB39Ba"; // your deployed ExitVault
const ABI = [
  "function invest() external payable",
  "function getBalance(address investor) external view returns (uint256)",
  "function withdraw(uint256 amount) external",
  "event Invest(address indexed investor, uint256 amount)",
  "event Withdraw(address indexed investor, uint256 amount)"
];

export default function ExitVaultUI() {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [account, setAccount] = useState(null);
  const [contract, setContract] = useState(null);
  const [balanceEth, setBalanceEth] = useState("0.0");
  const [inputEth, setInputEth] = useState("");
  const [status, setStatus] = useState("");
  const [txs, setTxs] = useState([]);

  // connect wallet
  async function connectWallet() {
    if (!window.ethereum) {
      setStatus("No injected wallet found (install MetaMask)");
      return;
    }
    try {
      const browserProvider = new ethers.BrowserProvider(window.ethereum);
      await browserProvider.send("eth_requestAccounts", []);
      const signer = await browserProvider.getSigner();
      const account = await signer.getAddress();
      setProvider(browserProvider);
      setSigner(signer);
      setAccount(account);
      const c = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
      setContract(c);
      setStatus("Wallet connected: " + account);
      fetchBalance(c, account);
      listenEvents(c);
    } catch (err) {
      console.error(err);
      setStatus("Failed to connect wallet: " + (err.message || err));
    }
  }

  // fetch balance from contract for the connected account
  async function fetchBalance(c = contract, addr = account) {
    if (!c || !addr) return;
    try {
      const bal = await c.getBalance(addr);
      // ethers v6 BigInt -> format
      const eth = ethers.formatEther(bal);
      setBalanceEth(eth);
    } catch (err) {
      console.error(err);
      setStatus("Failed to fetch balance: " + (err.message || err));
    }
  }

  // invest (send ETH)
  async function doInvest() {
    if (!contract || !signer) return setStatus("Connect wallet first");
    if (!inputEth || Number(inputEth) <= 0) return setStatus("Enter valid ETH amount");
    try {
      setStatus("Sending transaction...");
      const tx = await signer.sendTransaction({
        to: CONTRACT_ADDRESS,
        value: ethers.parseEther(inputEth)
      });
      addTx(tx.hash, "Invest (sent)");
      setStatus("Waiting for confirmation...");
      await tx.wait();
      addTx(tx.hash, "Confirmed: Invest");
      setStatus("Invest confirmed");
      setInputEth("");
      fetchBalance();
    } catch (err) {
      console.error(err);
      setStatus("Tx failed: " + (err.message || err));
    }
  }

  // withdraw
  async function doWithdraw() {
    if (!contract || !signer) return setStatus("Connect wallet first");
    const amount = prompt("Amount of ETH to withdraw (e.g. 0.1)");
    if (!amount) return;
    try {
      const wei = ethers.parseEther(amount);
      setStatus("Sending withdraw tx...");
      const tx = await contract.withdraw(wei);
      addTx(tx.hash, `Withdraw initiated ${amount} ETH`);
      await tx.wait();
      addTx(tx.hash, `Withdraw confirmed ${amount} ETH`);
      setStatus("Withdraw confirmed");
      fetchBalance();
    } catch (err) {
      console.error(err);
      setStatus("Withdraw failed: " + (err.message || err));
    }
  }

  function addTx(hash, note) {
    setTxs((s) => [{ hash, note, time: new Date().toLocaleString() }, ...s].slice(0, 20));
  }

  function listenEvents(c) {
    if (!c) return;
    // remove previous listeners
    try { c.removeAllListeners("Invest"); c.removeAllListeners("Withdraw"); } catch (e) {}
    c.on("Invest", (investor, amount) => {
      const eth = ethers.formatEther(amount);
      addTx(`event:${investor}:${amount}`, `Invest event ${investor} +${eth} ETH`);
      // if it's the connected user, refresh
      if (investor.toLowerCase() === (account || "").toLowerCase()) fetchBalance();
    });
    c.on("Withdraw", (investor, amount) => {
      const eth = ethers.formatEther(amount);
      addTx(`event:${investor}:${amount}`, `Withdraw event ${investor} -${eth} ETH`);
      if (investor.toLowerCase() === (account || "").toLowerCase()) fetchBalance();
    });
  }

  useEffect(() => {
    // auto-connect if wallet already authorized
    if (window.ethereum) {
      const p = new ethers.BrowserProvider(window.ethereum);
      p.listAccounts().then((arr) => {
        if (arr && arr.length > 0) connectWallet();
      }).catch(()=>{});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="max-w-xl mx-auto mt-8 p-6 bg-white/5 rounded-2xl shadow-lg">
      <h2 className="text-2xl font-semibold mb-4">ExitVault — Simple UI</h2>

      <div className="mb-4">
        {!account ? (
          <button onClick={connectWallet} className="px-4 py-2 bg-green-600 rounded text-white">Connect Wallet</button>
        ) : (
          <div className="flex items-center gap-3">
            <div className="text-sm text-gray-300">Connected: <span className="font-mono">{account}</span></div>
            <button onClick={() => { setAccount(null); setContract(null); setSigner(null); setStatus('Disconnected'); }} className="px-2 py-1 bg-gray-700 rounded text-sm">Disconnect</button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="p-4 bg-white/3 rounded">
          <div className="text-xs text-gray-400">Your balance in contract</div>
          <div className="text-xl font-bold">{balanceEth} ETH</div>
          <button onClick={() => fetchBalance()} className="mt-2 px-3 py-1 bg-blue-600 rounded text-white text-sm">Refresh</button>
        </div>

        <div className="p-4 bg-white/3 rounded">
          <div className="text-xs text-gray-400">Send ETH to invest</div>
          <input value={inputEth} onChange={(e)=>setInputEth(e.target.value)} className="w-full p-2 rounded mt-2 bg-black/10" placeholder="0.01" />
          <div className="flex gap-2 mt-2">
            <button onClick={doInvest} className="px-3 py-1 bg-green-600 rounded text-white">Invest</button>
            <button onClick={doWithdraw} className="px-3 py-1 bg-red-600 rounded text-white">Withdraw</button>
          </div>
        </div>
      </div>

      <div className="mb-4">
        <div className="text-sm text-gray-400">Status</div>
        <div className="p-3 bg-black/10 rounded">{status || 'Idle'}</div>
      </div>

      <div>
        <div className="text-sm text-gray-400 mb-2">Recent activity</div>
        <div className="space-y-2">
          {txs.length === 0 && <div className="text-gray-500">No activity yet</div>}
          {txs.map((t, i) => (
            <div key={i} className="p-2 bg-black/5 rounded flex justify-between items-center">
              <div className="text-xs">{t.note}</div>
              <div className="text-xs text-gray-400">{t.time}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


/*

--- Hardhat optimizer snippet (add to your hardhat.config.js) ---

solidity: {
  version: "0.8.24",
  settings: {
    optimizer: {
      enabled: true,
      runs: 200
    }
  }
}

Notes:
- If you compiled with optimizer enabled previously, keep the same settings for future verifications.
- If you didn't use optimizer, you can leave it disabled; Sourcify already matched your contract source.

*/
