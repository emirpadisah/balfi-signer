// api/claim.js
import { ethers } from "ethers";

export default async function handler(req, res) {
  try {
    // Sadece POST
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }

    // (Opsiyonel) Basit paylaşım sırrı ile koruma
    const needSecret = process.env.SIGNER_SECRET;
    const given = req.headers.authorization?.replace(/^Bearer\s+/i, "");
    if (needSecret && given !== needSecret) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    // Body'yi güvenli oku (JSON ya da form-urlencoded gelebilir)
    let body = req.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch { body = Object.fromEntries(new URLSearchParams(body)); }
    }
    body = body || {};
    const to  = (body.to || "").trim();
    const qty = Number(body.qty || 0);

    if (!/^0x[a-fA-F0-9]{40}$/.test(to))  return res.status(400).json({ ok:false, error:"Geçersiz adres" });
    if (!Number.isFinite(qty) || qty <= 0) return res.status(400).json({ ok:false, error:"Geçersiz miktar" });

    // ENV
    const RPC_URL   = process.env.RPC_URL || "https://mainnet.base.org";
    const PRIV_KEY  = process.env.PRIVATE_KEY;         // 0x....
    const DROP_ADDR = process.env.DROP_ADDRESS || "0x0eD5fFcC3D6b9EB9c894AA27EC1c78fd1719CB9B";
    const DECIMALS  = Number(process.env.TOKEN_DECIMALS || 18);
    const VALUE_PER = BigInt(process.env.CLAIM_VALUE_WEI_PER_UNIT || "0"); // çoğu kontratta 0

    if (!PRIV_KEY) return res.status(500).json({ ok:false, error:"PRIVATE_KEY env eksik" });

    // Ethers (v6)
    const provider = new ethers.JsonRpcProvider(RPC_URL, { name: "base", chainId: 8453 });
    const wallet   = new ethers.Wallet(PRIV_KEY, provider);

    const abi = ["function claimTo(address _to, uint256 _quantity) payable"];
    const c   = new ethers.Contract(DROP_ADDR, abi, wallet);

    // qty → units ve msg.value
    const units = ethers.parseUnits(String(qty), DECIMALS);
    const value = VALUE_PER * BigInt(qty);

    // İşlem
    const tx  = await c.claimTo(to, units, { value, gasLimit: 350000n });
    const rec = await tx.wait();

    return res.status(200).json({ ok:true, txHash: rec?.hash || tx?.hash });
  } catch (e) {
    console.error("claim.js error:", e);
    return res.status(500).json({ ok:false, error: e?.message || "fail" });
  }
}
