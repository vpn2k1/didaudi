# Kiến trúc dự án

Tài liệu này chỉ đường từ một thay đổi sản phẩm tới các lớp mã nguồn. Cách cài đặt, biến môi trường và các giới hạn khi triển khai nằm ở [README gốc](../README.md).

## Luồng chạy chính

```text
Trình duyệt → web/ (Next.js, cổng 3000)
             ├─ Server Components → BACKEND_URL/api/*
             └─ fetch('/api/*') → Next rewrite → be/ (Express, cổng 4000)
                                                   ├─ public routes → PlaceProvider
                                                   │                  ├─ LocalPlaceProvider → JsonPlaceRepository → places.json
                                                   │                  └─ GooglePlacesProvider → Places API (New)
                                                   └─ admin routes → JsonPlaceRepository → places.json
```

`be/src/server.ts` đọc cấu hình, `provinces.json`, `taxonomy.json`, `places.json`, `photos.json` rồi lắp app. `be/src/app.ts` lắp middleware, route công khai và admin. `web/next.config.ts` rewrite `/api/:path*`; `web/src/lib/api.ts` là client API chung. Server Components dùng `web/src/lib/server.ts` và `BACKEND_URL`, còn thành phần client dùng `/api` cùng origin.

## Bản đồ trách nhiệm

| Muốn thay đổi | Nơi bắt đầu | Nơi cần đối chiếu |
| --- | --- | --- |
| Trường hoặc validation địa điểm | `be/src/domain/schemas.ts` | `be/src/providers/PlaceProvider.ts`, `web/src/lib/types.ts`, form admin, dữ liệu JSON |
| Tìm kiếm, lọc và xếp hạng | `be/src/services/search.ts` | `be/src/routes/public.ts`, `web/src/components/ExploreView.tsx`, `be/test/search.test.ts` |
| Gợi ý lịch trình | `be/src/services/planner.ts` | `be/src/routes/public.ts`, `web/src/components/planner/PlannerView.tsx`, `be/test/planner.test.ts` |
| Dữ liệu local và CRUD | `be/src/repositories/jsonPlaceRepository.ts`, `be/src/routes/admin.ts` | `web/src/components/admin/`, `be/test/api.test.ts` |
| Nguồn Google Places | `be/src/providers/googlePlacesProvider.ts` | `PlaceProvider` capabilities, hiển thị bản đồ, `be/test/google.test.ts` |
| Trang, SEO và điều hướng | `web/src/app/` | `web/src/lib/format.ts`, `web/src/app/sitemap.ts`, `web/src/app/robots.ts` |
| Bản đồ và vị trí người dùng | `web/src/components/MapView.tsx`, `useUserLocation.ts` | `web/src/lib/geo.ts`, `be/src/lib/geo.ts` |

## Hợp đồng dữ liệu

`PlaceRepository` lưu bản ghi nội bộ; bản triển khai hiện tại nạp `be/data/places.json` và ghi tuần tự qua file tạm. `PlaceProvider` chuyển nguồn dữ liệu thành `PlaceSummary`/`PlaceDetail` cho API. Route admin làm việc trực tiếp với repository; route công khai lấy kết quả qua provider, trừ `/plan`, `/suggest` và `/photos` dựa trên dữ liệu nội bộ. `/plan` trả 501 khi provider không phải `local`.

Các endpoint công khai chính ở `be/src/routes/public.ts`: `/api/health`, `/meta`, `/provinces`, `/provinces/:slug`, `/provinces/:slug/places`, `/places/search`, `/google/places/search`, `/google/photo`, `/places/:slug`, `/plan`, `/suggest`, `/photos`. Endpoint Google chỉ bật khi server có key, không cache và có rate limit riêng; ảnh được tải qua server theo yêu cầu và không lưu trong `photos.json`. Dữ liệu local vẫn là nguồn mặc định. Admin ở `/api/admin/session` và `/api/admin/places`; mật khẩu và secret chưa cấu hình thì admin bị tắt. Schema Zod tại `be/src/domain/schemas.ts` và `be/src/services/planner.ts` là nguồn tham chiếu cho query và dữ liệu ghi.

`be/data/provinces.json` có 34 tỉnh/thành; `places.json` hiện có 140 địa điểm minh họa, mỗi tỉnh/thành có ít nhất một địa điểm kèm ảnh. `taxonomy.json` định nghĩa danh mục và tag. `photos.json` chứa URL, tác giả, giấy phép và kiểu ảnh (`place` hoặc `topic`); `place-sources.json` lưu nguồn địa danh, tọa độ và ảnh cho 66 điểm mới. Quy trình tìm ứng viên theo tỉnh/tên và giới hạn nguồn nằm tại [DATA_SOURCES.md](DATA_SOURCES.md). Khi sửa dữ liệu, đọc [skill biên tập địa điểm](../skills/curate-places/SKILL.md).

## Ranh giới quan trọng

- Dữ liệu demo và địa điểm chưa xác minh không được index. `NEXT_PUBLIC_ALLOW_INDEXING` chỉ là công tắc toàn site; trang địa điểm còn cần `source=local`, `isDemo=false`, `verificationStatus=verified` theo `web/src/lib/format.ts`.
- Google provider không cho index và yêu cầu bản đồ cùng provider. Giao diện hiện ẩn MapLibre khi dữ liệu yêu cầu bản đồ Google; chưa có adapter Google Maps JS.
- Tọa độ GPS chính xác lưu trong `sessionStorage` của trình duyệt. Backend nhận tọa độ đã làm tròn; middleware log chỉ ghi path, không ghi query string.
- `fe/` là Vite demo dùng API cũ. `be/db/schema.sql` chưa được runtime sử dụng. Đừng nhầm hai phần này với đường chạy mặc định `npm run dev`.
