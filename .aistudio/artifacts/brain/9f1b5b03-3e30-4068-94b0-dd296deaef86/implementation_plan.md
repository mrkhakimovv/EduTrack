# Admin Panel: O'quv Markaz Yaratish va Boshqarish Tizimi

Admin Panel interfeysida o'quv markazlarini yaratish tugmasini yuqori panel va jadval sarlavhasiga joylashtirish, hamda o'quv markazlari va individual o'qituvchilarni alohida tablarda to'liq boshqarish imkoniyatini kiritish.

## Foydalanuvchi Tasdiqlagan Qarorlar

> [!IMPORTANT]
> Foydalanuvchi quyidagi aniqlashtiruvchi javoblarni tasdiqladi:
> - **O'quv markaz yaratish tugmasi joylashuvi**: Admin panelning yuqori sarlavhasida (Tizimdan chiqish yonida) hamda jadval sarlavhasi yonida joylashadi.
> - **Ko'rinish tartibi**: Admin panelda **"O'quv markazlari"** va **"O'qituvchilar"** alohida tablarga (segmented control) ajratiladi.

---

## 1. Umumiy Konseptsiya va Maqsad

- **Muammo**: Super Admin (`admin` roli) tizimga kirganida faqat individual o'qituvchilar ro'yxatini ko'rayotgan edi, biroq Admin Panel ichida bevosita yangi O'quv Markazini yaratish va markazlar ro'yxatini ko'rish tugmasi yo'q edi.
- **Yechim**:
  1. Admin Panel yuqori header qismida ko'zga yaqqol tashlanadigan **"🏫 O'quv markaz yaratish"** tugmasi qo'shiladi.
  2. Jadval ustida ikkita asosiy tab kiritiladi:
     - **"O'quv markazlari"** (Markaz nomi, rahbari, markaz kodi, o'qituvchilari soni, to'lov holati, yaratilgan sana, amallar).
     - **"O'qituvchilar"** (Yakka tartibdagi yoki markaz o'qituvchilari, teacherId, username, to'lov holati, amallar).
  3. Jadval sarlavhasida mos ravishda **"+ O'quv markaz qo'shish"** va **"+ Yangi o'qituvchi"** harakat tugmalari joylashtiriladi.
  4. O'quv markazini yaratish modali orqali Markaz nomi, mas'ul shaxs, username, parol va telefon raqami kiritilib, avtomatik ravishda 6 xonali noyob Markaz ID (`centerCode`), `center_admin` hisobi va `centers` kolleksiyasiga hujjat yoziladi.
  5. Markaz ustiga bosilganda o'quv markazining barcha biriktirilgan o'qituvchilari, ularning guruhlari va o'quvchilari statistikasi batafsil modalda ochiladi.

---

## 2. Foydalanuvchi Tajribasi va Dizayn (UX & UI)

### Asosiy Oqimlar:
1. **Admin Panelga kirish**:
   - Super Admin kirganida yuqori panelda: `Admin Panel` sarlavhasi, **"🏫 O'quv markaz yaratish"** (aktsent tugma) va **"Tizimdan chiqish"** tugmalari ko'rinadi.
2. **Tablar orqali ko'rish**:
   - **O'quv markazlari tabi**: Har bir markaz nomi, markaz kodi (masalan `CTR-482910`), rahbari, biriktirilgan o'qituvchilar soni, tizim to'lovi holati (`Cheksiz` / oylar bo'yicha to'langan).
   - **O'qituvchilar tabi**: Mavjud yakka tartibdagi o'qituvchilar jadvali, ID, username, paroli va oylik to'lov gridi.
3. **Yaratish oynasi (Modal)**:
   - "O'quv markaz yaratish" tugmasi bosilganda qulay forma ochiladi:
     - O'quv markaz nomi (masalan: *"Cambridge Learning Center"*)
     - Rahbar / Mas'ul shaxs (Ism Familiya)
     - Username (markaz uchun noyob login)
     - Parol
     - Telefon raqami
   - Yaratilgach, avtomatik `SecondaryAuth` yordamida admin sessiyasini uzmasdan hisob ochiladi va markaz ma'lumotlari jadvalda darhol real vaqt rejimida aks etadi.

---

## 3. Texnik Arxitektura va Ma'lumotlar Modeli

```
┌─────────────────────────────────────────────────────────────┐
│                       AdminPanel                            │
├─────────────────────────────────────────────────────────────┤
│  Header: [Admin Panel]       [+ O'quv markaz] [Chiqish]    │
├─────────────────────────────────────────────────────────────┤
│  Tabs:   [🏫 O'quv markazlari (N)]   [👨‍🏫 O'qituvchilar (M)] │
├─────────────────────────────────────────────────────────────┤
│  Action Bar: [Qidiruv...]            [+ Yangi yaratish]     │
├─────────────────────────────────────────────────────────────┤
│  Table View:                                                │
│  - Agar O'quv markazlari: Markaz kodi, Nomi, Rahbari,       │
│    O'qituvchilar soni, To'lov holati, Amallar (Ko'rish, ...)│
│  - Agar O'qituvchilar: ID, Ism, Username, Parol, To'lov     │
└─────────────────────────────────────────────────────────────┘
```

### Firestore Ma'lumotlar Saqlanishi:
- **`users` kolleksiyasi**:
  - `role: 'center_admin'`
  - `centerId: string` (markaz hujjati ID si)
  - `centerCode: string` (6 xonali identifikator)
  - `centerName: string`
  - `fullName: string`
  - `username: string`
  - `plainPassword: string`
  - `appPayments: {}` / `isUnlimited: boolean`
- **`centers` kolleksiyasi**:
  - `id: string`
  - `code: string`
  - `name: string`
  - `adminUid: string`
  - `adminName: string`
  - `phone: string`
  - `createdAt: string`

---

## 4. Amalga Oshirish Bosqichlari (Reja)

1. **`AdminPanel.tsx` komponentini boyitish**:
   - `activeTab` holati (`'centers' | 'teachers'`).
   - Yuqori headerga `Building2` belgisi bilan **"O'quv markaz yaratish"** tugmasini qo'shish.
   - Jadval sarlavhasiga tablar (Segmented Control) va mos ravishda **"+ O'quv markaz qo'shish"** tugmasini qo'shish.
   - O'quv markazlarini ro'yxatdan olish uchun `CreateCenterModal` komponenti / holatini qo'shish.
   - O'quv markazlarini `centers` va `users` (role == `center_admin`) kolleksiyalaridan real-time yuklash.
   - Har bir markaz uchun biriktirilgan o'qituvchilar sonini hisoblash va ko'rsatish.
   - O'quv markazi qatorini bosganda markazning barcha o'qituvchilari, to'lov holati va ma'lumotlarini ko'rish oynasi.
2. **Kompilyatsiya va Tekshiruv**:
   - `compile_applet` va `lint_applet` yordamida TypeScript xatoliklarisiz tekshiruvdan o'tkazish.
