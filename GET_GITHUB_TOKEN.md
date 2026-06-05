# 🔐 Generate GitHub Personal Access Token (dengan Workflow Scope)

## Langkah-langkah:

1. **Buka halaman token generator**: https://github.com/settings/tokens/new

2. **Isi form:**
   - **Token name**: `act-deployment-token` (atau nama lain)
   - **Expiration**: Pilih waktu yang sesuai (90 days recommended)

3. **Select scopes (beri tanda ✅):**
   ```
   ✅ repo (Full control of private repositories)
   ✅ workflow (Update GitHub Action workflows)
   ✅ read:user (Read user profile data)
   ✅ user:email (Access email)
   ```

4. **Generate token** → Klik tombol "Generate token"

5. **Copy token** → Jangan lupa save di tempat aman!

---

## Format Token (contoh):
```
ghp_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX  (40+ karakter)
```

Setelah generate token baru dengan workflow scope, silakan kirimkan token baru tersebut.
