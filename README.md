# Đi Đâu Việt Nam – MVP bản đồ khám phá

Website giúp trả lời **"Gần tôi có gì hay?"** và **"Hôm nay nên đi đâu?"**: quán ăn, cà phê, điểm du lịch, vui chơi theo vị trí người dùng hoặc theo tỉnh/thành.

> ⚠️ Dữ liệu hiện tại là **dữ liệu minh họa** (74 địa điểm ở Hà Nội, Đà Nẵng, Ninh Bình). Nội dung do đội ngũ tự biên tập, **không có** rating, giá hay giờ mở cửa bịa đặt. Toàn bộ được gắn nhãn "Dữ liệu minh họa" và **không cho index**.

## Cấu trúc

```
vn-food-travel-map/
├── be/                    Backend API – Node 20 + Express + TypeScript (port 4000)
│   ├── data/              provinces.json (34 tỉnh/thành), taxonomy.json, places.json
│   ├── db/schema.sql      Schema PostgreSQL + PostGIS cho giai đoạn sau (chưa dùng)
│   ├── scripts/verify-osm.mjs   Đối chiếu tọa độ với OpenStreetMap
│   ├── src/
│   │   ├── providers/     PlaceProvider interface · LocalPlaceProvider · GooglePlacesProvider
│   │   ├── repositories/  PlaceRepository interface · JSON file repository
│   │   ├── services/      Tìm kiếm, lọc, xếp hạng
│   │   ├── auth/          Phiên admin (cookie ký HMAC) + chống CSRF
│   │   └── routes/        API công khai + admin
│   └── test/              Vitest + Supertest
├── web/                   Frontend – Next.js 15 (App Router) + React 19 + Tailwind 4 (port 3000)
│   ├── src/app/           Trang: / · /[tinh] · /dia-diem/[slug] · /tinh-thanh · /admin · sitemap · robots
│   ├── src/components/    ExploreView, MapView (MapLibre/Mapbox), PlaceCard, admin/…
│   ├── src/lib/           api, geo, format, types
│   └── test/              Vitest
└── fe/                    Bản demo Vite cũ (không còn dùng, xem cuối README)
```

## Chạy local

Yêu cầu Node ≥ 20.12.

```bash
npm run install:all
cp be/.env.example be/.env          # tùy chọn: điền ADMIN_PASSWORD / ADMIN_SESSION_SECRET để bật /admin
cp web/.env.example web/.env.local  # tùy chọn: mặc định đã chạy được
npm run dev
```

Mở http://localhost:3000. API ở http://localhost:4000/api. Trình duyệt luôn gọi `/api` qua proxy của Next.js, không gọi trực tiếp backend.

| Lệnh (ở thư mục gốc) | Việc |
|---|---|
| `npm run dev` | Chạy backend + web |
| `npm run check` | typecheck → lint → test → build (chạy trước khi deploy) |
| `npm test` | Test backend (35) + web (9) |
| `npm run verify` | Báo cáo đối chiếu tọa độ với OpenStreetMap |
| `node be/scripts/fetch-photos.mjs` | Lấy ảnh Wikimedia Commons (có ghi công) |

## Biến môi trường

**`be/.env`** (chỉ ở server, không commit):

| Biến | Bắt buộc | Mô tả |
|---|---|---|
| `PORT` | – | Mặc định 4000 |
| `PLACES_PROVIDER` | – | `local` (mặc định) hoặc `google` |
| `GOOGLE_PLACES_API_KEY` | khi `google` | Server key của Places API (New) |
| `ADMIN_PASSWORD` | để bật admin | ≥ 12 ký tự |
| `ADMIN_SESSION_SECRET` | để bật admin | ≥ 32 ký tự ngẫu nhiên (`openssl rand -base64 48`) |
| `TRUST_PROXY` | – | `1` nếu chạy sau reverse proxy |

**`web/.env.local`** (biến `NEXT_PUBLIC_*` sẽ lộ ra trình duyệt):

| Biến | Mô tả |
|---|---|
| `BACKEND_URL` | URL backend, chỉ dùng ở server Next.js |
| `NEXT_PUBLIC_SITE_URL` | URL công khai (canonical, sitemap) |
| `NEXT_PUBLIC_ALLOW_INDEXING` | `true` mới cho index. Mặc định `false` |
| `NEXT_PUBLIC_MAP_PROVIDER` | `maplibre` (mặc định) · `mapbox` · `none` (ẩn bản đồ, chỉ dùng danh sách) |
| `NEXT_PUBLIC_MAP_STYLE_URL` | Style MapLibre. Mặc định OpenFreeMap |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Public token `pk.*`, có giới hạn URL |

## Tính năng đã có

### Gợi ý theo nhu cầu (`/goi-y/...`)
Trang chủ có 5 lựa chọn lớn: **Du lịch & chụp ảnh · Hẹn hò · Ăn uống · Cà phê · Gia đình**. Bấm vào sẽ mở form riêng:

| Nhu cầu | Thông tin hỏi | Kết quả |
|---|---|---|
| Du lịch (`/goi-y/du-lich`) | Vị trí của tôi / chọn tỉnh (34 tỉnh sau sáp nhập) / nhập địa điểm · phong cách · thời gian · khoảng cách | Điểm chụp ảnh **sắp từ gần đến xa**, chia theo ngày nếu đi 2–3 ngày, có gợi ý chụp ảnh |
| Hẹn hò (`/goi-y/hen-ho`) | Khu vực · ngân sách cho 2 người · buổi · thời lượng · không khí · bán kính | Lịch trình đánh số (vd. ăn tối → dạo hồ → cà phê), **đổi được từng điểm** |
| Ăn uống / Cà phê | Khu vực · bữa / món / phong cách · ngân sách · bán kính | 3 gợi ý hàng đầu + các quán khác theo khoảng cách |
| Gia đình | Khu vực · buổi · ngân sách | Vui chơi → ăn uống → khám phá |

- Bản đồ hiện marker đánh số và đường nối lộ trình. Nút "Mở lộ trình trên Google Maps" mở deep link chỉ đường qua các điểm (miễn phí).
- Ô "Nhập địa điểm" gợi ý tỉnh/thành, khu vực (Phố cổ, Hồ Tây…) và địa điểm có trong dữ liệu. Không gọi dịch vụ geocoding bên ngoài.
- Link có thể chia sẻ: thông tin form nằm trên URL (không chứa tọa độ GPS).
- Thuật toán ở `be/src/services/planner.ts`, dựa trên quy tắc và giải thích được: khớp nhu cầu, sở thích, thời điểm (buổi tối bỏ bảo tàng/điểm trong nhà), ngân sách, khoảng cách, điểm tiếp theo gần nhất.
- **Ngân sách dùng "mức giá ước tính" (`priceLevel` 0–4)** do mình tự ước lượng cho dữ liệu demo. Giao diện luôn ghi "ước tính". Cần thay bằng giá đã kiểm chứng trước khi public.

### Ảnh địa điểm
- Ảnh thật lấy từ **Wikimedia Commons** (giấy phép tự do) qua API chính thức, bằng script `be/scripts/fetch-photos.mjs`. Kết quả lưu ở `be/data/photos.json` kèm **tác giả + giấy phép**, hiển thị ghi công trên từng ảnh.
- Hiện có 67/74 địa điểm có ảnh: 45 ảnh đúng địa điểm (ưu tiên liên kết Wikidata/Commons trên đối tượng OSM), 22 ảnh **món ăn/chủ đề**, được ghi rõ "ảnh minh họa món" và không trình bày như ảnh của quán. 7 điểm chưa có ảnh dùng ảnh vẽ dự phòng (`web/public/illustrations`), có ghi "Ảnh vẽ".
- **Không** lấy ảnh từ Google Maps bằng cách tải/cào (vi phạm điều khoản, ảnh thuộc bản quyền người đăng). Muốn dùng ảnh Google: tích hợp **Places API (New) – Place Photos** ở server (cần key, tính phí theo lượt, phải hiển thị tên tác giả theo `authorAttributions`, không lưu ảnh), và lưu ý điều khoản không cho hiển thị nội dung Places cạnh bản đồ không phải Google.
- Duyệt ảnh: chạy `node be/scripts/fetch-photos.mjs`, xem bảng báo cáo, sửa hoặc xóa mục sai trong `photos.json`. Đặt `"locked": true` để giữ ảnh đã duyệt. `--force` lấy lại tất cả, `--only=id1,id2` chỉ lấy các điểm chỉ định.

### Khám phá

- **Khám phá:**
  - Tìm theo tên, món, thẻ, tỉnh/thành, gõ không dấu được ("bien da nang" ra "Bãi biển Mỹ Khê"). Có debounce, từ khóa giữ trên URL.
  - 4 danh mục: Ăn uống, Cà phê, Du lịch, Vui chơi.
  - Bộ lọc nhanh "Gần tôi". Các chip "Đánh giá cao", "Giá rẻ", "Đang mở cửa" **chỉ hiện khi dữ liệu có**.
  - Sắp xếp theo phù hợp nhất, gần nhất, đánh giá cao (khi provider hỗ trợ).
  - Phân trang "Xem thêm", mục "Được biên tập chọn".
  - Đủ các trạng thái: skeleton, lỗi kèm nút thử lại, kết quả rỗng kèm gợi ý hành động.
- **Vị trí:**
  - Chỉ xin quyền khi bấm "Tìm quanh tôi". Bán kính mặc định 5 km, đổi được 1–20 km.
  - Xử lý đủ các trường hợp: từ chối quyền (chuyển focus sang ô chọn tỉnh), timeout, không hỗ trợ, không phải HTTPS.
  - **Vị trí chính xác chỉ ở trên máy người dùng.** Server chỉ nhận tọa độ làm tròn khoảng 1 km. Khoảng cách tính ở client, backend không ghi query string vào log.
- **Bản đồ:**
  - Marker theo danh mục, đồng bộ hai chiều với danh sách (hover, chọn).
  - Chọn marker hiện thẻ tóm tắt với nút Chi tiết, Google Maps, Chỉ đường.
  - Desktop xem song song danh sách và bản đồ. Mobile có nút nổi chuyển Danh sách/Bản đồ.
  - Có fallback khi chưa cấu hình, khi lỗi WebGL/style, hoặc khi dữ liệu Google bắt buộc phải hiển thị trên bản đồ Google.
  - Nhãn bản đồ hiển thị tên tiếng Việt.
- **Trang chi tiết:** danh mục, địa chỉ, tọa độ, mô tả. Giá, giờ mở cửa, website, điện thoại và rating chỉ hiện khi có dữ liệu. Có trạng thái xác minh, nguồn/attribution, link tới đối tượng OSM, nút "Mở trên Google Maps" và "Chỉ đường", cùng mục địa điểm gần đó.
- **Trang tỉnh/thành:** `/ha-noi`, `/da-nang`, `/ninh-binh`… cho cả 34 đơn vị, lấy từ `data/provinces.json`. Có metadata và canonical riêng. Tỉnh chưa có dữ liệu sẽ hiện empty state và `noindex`.
- **Admin (`/admin`):**
  - Đăng nhập bằng mật khẩu, cookie `HttpOnly; SameSite=Strict` ký HMAC, phiên 8 giờ.
  - Mọi request ghi bắt buộc có header chống CSRF. Đăng nhập bị giới hạn 10 lần/15 phút.
  - Thêm, sửa, xóa địa điểm, trạng thái draft/published. Validate bằng Zod ở server, lỗi hiện theo từng trường.
  - Khi chưa cấu hình mật khẩu, mọi API admin trả 503.
- **SEO:**
  - Metadata theo trang, canonical, `sitemap.xml`, `robots.txt`.
  - Chỉ index trang địa điểm `verified` và không phải demo. Trang tỉnh cần ít nhất 3 địa điểm như vậy.
  - Khi `NEXT_PUBLIC_ALLOW_INDEXING=false`, chặn toàn bộ.
- **Bảo mật:**
  - Helmet, security headers (`X-Frame-Options`, `Permissions-Policy: geolocation=(self)`…).
  - Rate limit API tìm kiếm 120/phút/IP. Giới hạn bán kính tối đa 50 km và page size tối đa 50.
  - Link website chỉ chấp nhận `http(s)` để chặn XSS qua `javascript:`.

## Kiến trúc dữ liệu

- `PlaceProvider` (`be/src/providers/PlaceProvider.ts`) là interface để UI không phụ thuộc nguồn dữ liệu.
  - `LocalPlaceProvider`: dữ liệu nội bộ, quản lý qua admin. Ở local chạy với dữ liệu minh họa nên không cần API key; đây chính là "MockPlaceProvider" trong đặc tả.
  - `GooglePlacesProvider`: Places API (New), **chỉ chạy ở server**. Dùng field mask tối thiểu (không lấy reviews/photos), timeout 8 giây, retry 1 lần, **không cache hay lưu** nội dung Google. Báo `requiresProviderMap` (frontend sẽ ẩn bản đồ MapLibre) và `indexable: false`. Có unit test với fetch giả lập; **chưa chạy với key thật**.
- `PlaceRepository`: hiện lưu vào file JSON (ghi tuần tự, ghi file tạm rồi đổi tên). Bước tiếp theo là PostgreSQL + PostGIS (`be/db/schema.sql`).
- **Xếp hạng giải thích được:**
  - Khớp từ khóa: tên > thẻ/danh mục > địa chỉ/mô tả. Có ưu tiên khớp đúng thẻ và đúng dấu để phân biệt "phở" với "phố".
  - Cộng thêm điểm khoảng cách, trạng thái xác minh, "biên tập chọn".
  - Rating của Google được làm mượt theo kiểu Bayesian để tránh thiên lệch, không dùng rating đơn lẻ.
  - Nhãn "Gần bạn" (≤ 1 km), "Khớp tìm kiếm", "Được biên tập chọn" đều dựa trên tiêu chí thật.
- **Giờ mở cửa:** tính theo `Asia/Ho_Chi_Minh`, hỗ trợ mở qua đêm. Dữ liệu xác minh quá 180 ngày sẽ bị coi là "không rõ", không báo "đang mở".

### Độ chính xác tọa độ

52/74 địa điểm đã đối chiếu với OpenStreetMap (`verificationStatus: coordinates_checked`). 22 điểm còn lại là `unverified`, marker viền nét đứt.

Quy trình bổ sung:

1. Chạy `npm --prefix be run verify -- --province=<slug>` để xem báo cáo.
2. **Đọc từng dòng.** Có những khớp nhầm như "Tam Cốc Mart" hay chùa Mỹ Khê.
3. Chạy `npm --prefix be run verify:apply -- --ids=a,b,c` để chỉ ghi các điểm đã duyệt.

## Deploy (chưa thực hiện)

- **web/** lên Vercel (hoặc Node host bất kỳ): `npm run build`, rồi `npm start`. Đặt `BACKEND_URL`, `NEXT_PUBLIC_SITE_URL`. Gói Hobby của Vercel không cho dùng thương mại.
- **be/** cần host Node chạy liên tục **có ổ đĩa bền vững**, vì đang lưu file JSON (Render, Fly.io, Railway, VPS…). Không dùng được serverless cho tới khi chuyển sang Postgres.
- Bật HTTPS (bắt buộc cho định vị), đặt `NODE_ENV=production` (để cookie có cờ `Secure`), và `TRUST_PROXY=1` nếu chạy sau proxy.

## Trước khi public: API key và chi phí ước tính

Giá tham khảo tại thời điểm viết; **kiểm tra lại bảng giá hiện hành** trước khi quyết định.

| Hạng mục | Cần gì | Chi phí ước tính |
|---|---|---|
| Tên miền | – | ~300k–800k đ/năm |
| Hosting web | Vercel Pro hoặc tương đương | ~20 USD/tháng (Hobby không cho thương mại) |
| Hosting backend | Node chạy liên tục + ổ đĩa (sau này + Postgres) | ~5–25 USD/tháng |
| Tile bản đồ | OpenFreeMap: miễn phí, không có SLA. Production nên dùng **MapTiler** (key giới hạn domain), Mapbox, hoặc tự host | 0 → ~25 USD+/tháng tùy lưu lượng |
| Google Places (tùy chọn) | Google Cloud project, bật Places API (New), **server key** giới hạn API + IP, bật billing + **budget alert + quota** | Có hạn mức miễn phí theo từng SKU mỗi tháng. Rating/giờ mở cửa thuộc SKU Enterprise, khoảng 20–40 USD / 1.000 request sau hạn mức. 10.000 lượt tìm kiếm/tháng có thể tốn vài trăm USD |
| Admin | `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET` | 0 |

## Còn thiếu và bước tiếp theo

1. **Dữ liệu thật:** xác minh thực địa, đổi `isDemo=false`, `verificationStatus=verified`, bổ sung giá/giờ mở cửa đã kiểm chứng và ảnh có quyền sử dụng. Khi đó mới bật `NEXT_PUBLIC_ALLOW_INDEXING=true`.
2. **PostgreSQL + PostGIS:** viết `PostgresPlaceRepository` theo `db/schema.sql`, dùng `ST_DWithin`. Cần thiết trước khi dữ liệu lớn.
3. **Google:** nếu bật provider Google cần adapter bản đồ Google Maps JS (vì điều khoản cấm hiển thị dữ liệu Places trên bản đồ khác) và rà lại điều khoản mới nhất.
4. **Admin:** nhiều tài khoản, phân quyền, nhật ký thay đổi, upload ảnh.
5. **E2E test** (Playwright) và kiểm tra a11y tự động (axe). Hiện mới kiểm tra thủ công trên trình duyệt.
6. Thể hiện Hoàng Sa, Trường Sa: style bản đồ tự host hoặc Mapbox Studio để kiểm soát nhãn.
7. Mã tỉnh trong `provinces.json` là mã nội bộ. Cần đối chiếu mã hành chính chính thức nếu tích hợp hệ thống khác.

## Bản demo cũ (`fe/`)

`fe/` là bản demo Vite + React đầu tiên (port 5173). Nó gọi API cũ `/api/places?lat&lng` hiện không còn, nên **không chạy đúng với backend mới**. Lý do giữ lại: chưa được phép xóa. Có thể xóa thư mục này khi không cần nữa. Dữ liệu cũ của nó vẫn còn trong `be/data/hanoi.json`; các file `be/src/server.js` và `be/src/geo.js` cũng là code cũ, không còn dùng.
