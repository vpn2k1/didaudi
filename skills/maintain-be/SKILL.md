---
name: maintain-be
description: Sửa hoặc mở rộng backend Express TypeScript trong be/ của Đi Đâu Việt Nam: API, provider, repository, planner, tìm kiếm và admin. Với biên tập dữ liệu địa điểm thuần túy, dùng skill curate-places.
---

# Làm việc với backend `be/`

Đọc [kiến trúc](../../docs/ARCHITECTURE.md) để xác định đường đi của request. Backend chạy từ `be/src/server.ts`: nạp cấu hình và dữ liệu, chọn `LocalPlaceProvider` hoặc `GooglePlacesProvider`, rồi tạo Express app ở `be/src/app.ts`.

## Chọn đúng lớp

- Hợp đồng dữ liệu, query và validation: `be/src/domain/schemas.ts`; đối chiếu `be/src/providers/PlaceProvider.ts` và `web/src/lib/types.ts` khi đổi response.
- Endpoint công khai và cache header: `be/src/routes/public.ts`. Xếp hạng, bộ lọc, gợi ý vị trí và lịch trình: `be/src/services/`.
- CRUD admin: `be/src/routes/admin.ts`, xác thực ở `be/src/auth/adminAuth.ts`. Giữ cookie, kiểm tra CSRF và rate limit khi sửa luồng ghi.
- Lưu trữ hiện tại: `be/src/repositories/jsonPlaceRepository.ts` ghi `be/data/places.json` tuần tự qua file tạm. `be/db/schema.sql` chưa được kết nối runtime.
- Tích hợp Google: `be/src/providers/googlePlacesProvider.ts`. Key chỉ ở server; giữ attribution, `requiresProviderMap`, `indexable=false` và không lưu nội dung Google vào repository.

## Kiểm tra thay đổi

Chạy `npm --prefix be run typecheck` và `npm --prefix be test`. Với API mới hoặc thay đổi response, kiểm tra tác động tới client trong `web/src/lib/api.ts`, các type của web và các bài test API liên quan. Test hiện dùng Vitest/Supertest và có thể tạo app với repository trong bộ nhớ từ `be/test/fixtures.ts`, không cần ghi dữ liệu thật.

Nếu công việc là thêm/sửa bản ghi trong `be/data/`, đọc thêm [skill biên tập địa điểm](../curate-places/SKILL.md). Không dùng `be/src/server.js` hay `be/src/geo.js` cho backend hiện hành.
