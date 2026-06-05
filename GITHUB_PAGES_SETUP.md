# 🚀 Enable GitHub Pages - Steps

Silakan ikuti langkah berikut untuk enable GitHub Pages:

## Step 1: Buka GitHub Repository Settings

**URL**: https://github.com/csmajoo/act/settings/pages

## Step 2: Configure GitHub Pages

Di halaman **Settings → Pages**, lakukan:

1. **Source** → Pilih: `Deploy from a branch`
2. **Branch** → Pilih: `master` / `main`
3. **Folder** → Pilih: `/ (root)` atau `/docs`
   - Karena build sudah ada di folder `/docs`, pilih `/docs`
4. Click **Save**

## Step 3: Tunggu hingga Deploy selesai

- GitHub akan otomatis trigger deployment
- Status akan berubah dari "Pending" → "Active"
- Proses biasanya <1 menit

## Step 4: Akses Aplikasi

Setelah "Active", aplikasi bisa diakses di:

```
https://csmajoo.github.io/act/
```

---

## Verifikasi

Silakan lakukan setelah GitHub Pages active:

1. ✅ Buka https://csmajoo.github.io/act/
2. ✅ Login page harus tampil
3. ✅ Pilih user dari dropdown
4. ✅ Dashboard harus muncul dengan data
5. ✅ Responsive design tested on mobile

---

**Created**: 2026-06-05  
**Next Steps**: Setup Supabase environment variables
