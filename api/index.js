// GET /api  → sağlık kontrolü
module.exports = (req, res) => {
  res.status(200).send("✅ signer aktif");
};
