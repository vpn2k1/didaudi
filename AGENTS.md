# Hướng dẫn cho agent

Đây là dự án **Đi Đâu Việt Nam**. Đọc [README.md](README.md) để chạy local và xem trạng thái sản phẩm; đọc [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) để tìm đúng lớp cần sửa.

## Phạm vi mã nguồn

- `web/` là giao diện đang dùng: Next.js 15, App Router, React 19. Các trang ở `web/src/app/`, logic gọi API ở `web/src/lib/api.ts`.
- `be/` là Express API TypeScript. `be/src/server.ts` lắp cấu hình, repository và provider; `be/src/app.ts` lắp route và middleware.
- `fe/`, `be/src/server.js`, `be/src/geo.js` và `be/data/hanoi.json` là bản demo cũ. Không dùng chúng để triển khai tính năng mới trừ khi yêu cầu nhắc đích danh.
- `be/db/schema.sql` là thiết kế PostGIS cho tương lai; runtime hiện dùng `be/data/places.json` qua `JsonPlaceRepository`.
- Khi sửa backend, đọc [skill backend](skills/maintain-be/SKILL.md). Khi yêu cầu nhắc rõ frontend Vite cũ, đọc [skill frontend cũ](skills/maintain-fe/SKILL.md).

## Quy ước cần giữ

- Giữ hợp đồng API giữa `be/src/domain/schemas.ts`, `be/src/providers/PlaceProvider.ts` và `web/src/lib/types.ts` đồng bộ khi đổi trường dữ liệu.
- Trình duyệt gọi `/api` cùng origin; Next.js rewrite tới backend. Không đưa server key hay thông tin admin vào biến `NEXT_PUBLIC_*`.
- Dữ liệu địa điểm hiện là minh họa. Không tự đổi `isDemo`, `verificationStatus`, giá hay giờ mở cửa thành đã xác minh nếu không có nguồn kiểm chứng. Giữ ghi công và giấy phép ảnh trong `be/data/photos.json`, nguồn địa danh/tọa độ trong `be/data/place-sources.json`.
- Vị trí GPS chính xác chỉ nằm ở client; request tới backend dùng tọa độ đã làm tròn. Không ghi query string chứa tọa độ vào log.
- Google Places chỉ chạy phía server. Tôn trọng `provider.info.capabilities` khi hiển thị bản đồ và lập trang index; không cache dữ liệu Google trong repository.
- Với thay đổi dữ liệu địa điểm, dùng [skill biên tập địa điểm](skills/curate-places/SKILL.md). Các script OSM/ảnh có gọi dịch vụ bên ngoài và có chế độ ghi file; xem kết quả trước khi áp dụng.

## Kiểm tra theo phần đã sửa

- Backend: `npm --prefix be run typecheck` và `npm --prefix be test`.
- Web: `npm --prefix web run typecheck`, `npm --prefix web run lint`, `npm --prefix web test`; chạy `npm --prefix web run build` khi đổi route, metadata hoặc cấu hình build.
- Frontend Vite cũ: `npm --prefix fe run build` khi có sửa `fe/`.
- Khi đổi cả hai hoặc chuẩn bị phát hành: `npm run check` ở thư mục gốc.
- Không sửa dữ liệu gốc hay tạo request mạng chỉ để chạy kiểm tra. Nêu rõ bước chưa thể kiểm tra nếu thiếu dịch vụ hay khóa API.
